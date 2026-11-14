import { after, NextResponse } from "next/server";
import { hasApiKey, prepareBackdrop, readyNewcomer, reuseOf, StoryRefusal, streamSegment, type SegmentEvent } from "@/server/claude";
import { prepareParts } from "@/server/paint/parts-maker";
import { reportError } from "@/server/alerts";
import { errorResponse } from "@/server/errors";
import { mockSegment } from "@/server/mock";
import { parseStoryRequest } from "@/server/validate";
import { auth } from "@/server/auth";
import { guard, limitMessage, peekLimit, peekStart, whoIs } from "@/server/limits";
import { limitsFor, tierFor, storyCredits, CREDITS_PER_STORY_MINUTE, FREE_STORY_MINUTES, STORY_CREDITS_RANGE } from "@/lib/tiers";
import { inLegacyGrace, signPage, signPlace, storyTicket, storyTicketIsValid } from "@/server/tickets";
import type { CharacterDef, Page, StoryPlace } from "@/lib/types";
import { count, withMetricsUser } from "@/server/metrics";
import { beginGen, logDenied } from "@/server/genlog";
import { BUSY_ELSEWHERE, busyElsewhere, claimStorySession, deviceOf } from "@/server/story-session";

export const runtime = "nodejs";
// (5 minutes: a story's places and new characters are readied after its
// pages are sent, while they're read)
export const maxDuration = 300;

/** Can the signed-in user begin a new story right now? (Checked by the
 *  setup wizard before it creates the story, so nobody ends up with an
 *  empty draft when they've hit the limit.) */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ canStart: false, error: "Please sign in to make stories." }, { status: 401 });
  // (the plan as the records have it now, not the cookie's copy)
  const me = await whoIs(session);
  if (!me) return NextResponse.json({ canStart: false, error: "Please sign in to make stories." }, { status: 401 });
  if (me.account?.suspended) return NextResponse.json({ canStart: false, error: "This account can't make new stories at the moment. Please get in touch with us and we'll sort it out." }, { status: 403 });
  const user = me.user;
  // (one story at a time, on one device at a time)
  // (...asked for alongside what the plan has left)
  const [busy, peek] = await Promise.all([busyElsewhere(user.id, deviceOf(req)), peekStart(user)]);
  if (busy) return NextResponse.json({ canStart: false, limited: "busy", error: BUSY_ELSEWHERE, plan: tierFor(user).name });
  const { retryAfterSec, limited, left } = peek;
  let ok = peek.ok;
  // The plan's free stories are used up, on a plan that then pays with
  // credits: a story can begin if there are credits for the shortest one -
  // and the page is told, so it can say what this one will cost.
  let credits: { perMinute: number; balance: number } | undefined;
  if (!ok && limited === "story" && tierFor(user).credits === "auto" && me.account) {
    const balance = await me.account.spendable();
    if (balance !== null) {
      credits = { perMinute: CREDITS_PER_STORY_MINUTE, balance };
      ok = balance >= STORY_CREDITS_RANGE[0];
    }
  }
  // One of the plan's free stories is there to be used: it can be up to
  // so many minutes - a longer story is paid for with credits instead (the
  // page asks which, with what's in the account).
  let free: { minutes: number; perMinute: number; balance: number | null } | undefined;
  if (peek.ok && tierFor(user).credits === "auto" && tierFor(user).limits.stories && me.account) {
    free = { minutes: FREE_STORY_MINUTES, perMinute: CREDITS_PER_STORY_MINUTE, balance: await me.account.spendable().catch(() => null) };
  }
  // (what there is to spend, by kind - so the page can say exactly what a
  // story will use: "1 free Quest + 2 weekly credits")
  const wallet = me.account && tierFor(user).credits === "auto" ? await Promise.all([me.account.weekly(), me.account.credits()]).then(([weekly, bought]) => (weekly === null || bought === null ? null : { weekly, bought }), () => null) : null;
  return NextResponse.json({
    canStart: ok,
    credits,
    free,
    wallet,
    freeLeft: peek.ok && tierFor(user).limits.stories ? ((await peekLimit(user, "story").catch(() => null))?.left ?? null) : 0,
    retryAfterSec,
    limited: ok ? undefined : limited,
    startsLeft: left,
    windowHours: tierFor(user).limits.stories?.hours,
    plan: tierFor(user).name,
    // (with no credits at all, it's simply the plan's own limit that's said)
    error: ok ? undefined : credits && credits.balance > 0 ? `This week's free story is used, and a story needs at least ${STORY_CREDITS_RANGE[0]} credits - there ${credits.balance === 1 ? "is" : "are"} ${credits.balance}.` : limitMessage(user, limited, retryAfterSec),
  });
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as { ticket?: unknown } | null;
  const parsed = parseStoryRequest(raw);
  if (!parsed) return NextResponse.json({ error: "That story request looks incomplete." }, { status: 400 });

  // A story counts toward the plan at its first choice, not when it's
  // begun (see server/limits):
  //   beginning one     needs a story still left on the plan, and uses one
  //                     of the plan's beginnings
  //   the first choice  uses the story itself - once: asking again for the
  //                     same choice (a retry, another device) is free
  //   later choices     use the (generous) segment cap
  // ...provided it really is a story this account began: the request must
  // carry the ticket the server gave out with the part before. Anything
  // else that calls itself a continuation is counted as what it is, a new
  // story.
  // (for the activity log: what it was counted as)
  // One story at a time, on one device at a time: a story can't be begun
  // here while another device is in the middle of making one. (Carrying a
  // story on is never refused - only noted, so the session follows it.)
  const asker = (await auth())?.user?.id;
  if (asker) {
    const mine = await claimStorySession(asker, deviceOf(req));
    if (!mine && parsed.kind === "start") return NextResponse.json({ error: BUSY_ELSEWHERE, limited: "busy" }, { status: 409 });
  }
  let countedAs: string | null = null;
  const g = await guard((session) => {
    // (in credits: one a minute of the length chosen - see lib/tiers)
    if (parsed.kind === "start") return { bucket: "start", needs: "story", credits: storyCredits(parsed.minutes) };
    const user = session.user;
    // (a plan where every story costs credits - the admin's test account -
    // is charged at the story's first choice like any other, though its
    // requests aren't otherwise checked)
    if (!limitsFor(user).verified && tierFor(user).credits !== "beyond" && parsed.story.segments.length === 1) {
      return { bucket: "story", key: storyTicket(user.id, parsed.story), credits: storyCredits(parsed.story.minutes) };
    }
    if (!limitsFor(user).verified) return "segment";
    // (for a short while, stories begun before tickets existed carry on)
    const ticketed = storyTicketIsValid(user.id, parsed.story, raw?.ticket);
    const genuine = ticketed || inLegacyGrace();
    if (!genuine) {
      countedAs = "no ticket: counted as a new story";
      // (a story in its own right: with its own name to be counted and
      // paid under, and its length's price)
      return { bucket: "story", key: storyTicket(user.id, parsed.story), credits: storyCredits(parsed.story.minutes) };
    }
    if (!ticketed) countedAs = "no ticket (grace period)";
    return parsed.story.segments.length === 1 ? { bucket: "story", key: storyTicket(user.id, parsed.story), credits: storyCredits(parsed.story.minutes) } : "segment";
  }, { useCredits: (raw as { useCredits?: unknown } | null)?.useCredits === true });
  // (for the activity log: what was asked)
  const chosen = parsed.kind === "start" ? null : parsed.story.segments[parsed.story.segments.length - 1]?.chosen;
  const logged = (user: { id: string } | undefined, tier?: string) => ({
    kind: "story" as const,
    sub: parsed.kind === "start" ? "a new story" : `part ${parsed.story.segments.length + 1}`,
    what: parsed.kind === "start" ? `${parsed.theme} (age ${parsed.age}, ${parsed.minutes} minutes)` : `after choosing: ${chosen?.text ?? "(nothing)"}${chosen?.custom ? " (their own idea)" : ""}`,
    cases:
      parsed.kind === "start"
        ? ["the beginning"]
        : ["a continuation", parsed.story.segments.length === 1 ? "the first choice" : "a later choice", chosen?.custom ? "their own idea" : "a choice offered", countedAs].filter((c): c is string => Boolean(c)),
    userId: user?.id ?? null,
    tier,
    storyId: parsed.storyId,
    req,
    request: parsed,
    mock: !hasApiKey(),
  });
  if (!g.ok) {
    await logDenied(logged((await auth())?.user), g.response);
    return g.response;
  }
  const userId = g.session.user.id;
  const gen = beginGen(logged(g.session.user, tierFor(g.session.user).name));
  // Everything sent out is signed for this account: each page (to be
  // painted and published later), and the story so far (to ask for the
  // next part).
  const signed = (pages: Page[]) => pages.map((p) => ({ ...p, sig: signPage(userId, p) }));
  const signedPlaces = (places: StoryPlace[] | undefined) => places?.map((p) => ({ ...p, sig: signPlace(userId, p) }));
  const soFar = parsed.kind === "start" ? { age: parsed.age, minutes: parsed.minutes, theme: parsed.theme, segments: [] } : parsed.story;
  const stamp = (event: SegmentEvent): SegmentEvent => {
    if (event.type === "pages") return { ...event, pages: signed(event.pages), ...(event.places ? { places: signedPlaces(event.places) } : {}) };
    if (event.type !== "done") return event;
    const r = event.response;
    const segment = { ...r.segment, pages: signed(r.segment.pages) };
    const ticket = r.ending ? undefined : storyTicket(userId, { ...soFar, segments: [...soFar.segments, segment] });
    return { ...event, response: { ...r, segment, ticket, ...(r.places ? { places: signedPlaces(r.places) } : {}) } };
  };

  // Streams newline-delimited JSON events: {type:"pages"} each time another
  // page is ready (so the reader can start on page 1 while the rest is
  // still being written), then {type:"done"} with the finished segment, or
  // {type:"error"}.
  // If the reader leaves (closes the tab, moves to another page), stop the
  // model straight away: nobody will receive the rest, so finishing it
  // would only spend tokens on a result that's thrown away.
  const stop = new AbortController();
  // (new characters readied for reuse while the pages are read: see below)
  const readying: Promise<unknown>[] = [];
  req.signal.addEventListener("abort", () => stop.abort(), { once: true });
  const encoder = new TextEncoder();
  const body = withMetricsUser(userId, () => gen.run(() => new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const made: { v: { summary: string; result: string; cases: string[] } | null; ticket?: string | null } = { v: null };
      const send = (event: SegmentEvent | { type: "error"; error: string }) => {
        if (stop.signal.aborted) return;
        const out = event.type === "error" ? event : stamp(event);
        // (a beginning's ticket names the story it began: what's held for it is kept under that name)
        if (out.type === "done" && parsed.kind === "start") made.ticket = (out.response as { ticket?: string }).ticket ?? null;
        const line = JSON.stringify(out) + "\n";
        controller.enqueue(encoder.encode(line));
        // (the title alone isn't the story: "first seen" is the first page)
        if (event.type !== "title") gen.sent(line.length);
        if (event.type === "done") {
          const r = event.response;
          const words = r.segment.pages.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
          made.v = { summary: `${r.segment.pages.length} pages, ${words} words${r.ending ? ", the ending" : r.segment.choice ? ", then a choice" : ""}`, result: JSON.stringify(r, null, 1), cases: [r.ending ? "the ending" : r.segment.choice ? "ends on a choice" : "ends without a choice"] };
        }
      };

      try {
        if (!hasApiKey()) {
          // Demo mode: the templated storyteller, "written" page by page.
          const seg = mockSegment(parsed);
          if (seg.title) {
            await new Promise((r) => setTimeout(r, 700));
            send({ type: "title", title: seg.title });
          }
          for (let i = 1; i <= seg.segment.pages.length; i++) {
            await new Promise((r) => setTimeout(r, i === 1 ? 900 : 700));
            send({ type: "pages", newCharacters: seg.newCharacters, pages: seg.segment.pages.slice(0, i) });
          }
          send({ type: "done", response: { ...seg, demo: true } });
        } else {
          // Everything the live painting needs, readied as early as it's
          // known, each once: the story's characters' parts from the start;
          // each place the moment the storyteller names it (with the first
          // pages, before the rest is written); each new character as it's
          // brought in. A page asking before it's ready waits for the same
          // making - nothing is made twice.
          const reuse = reuseOf({});
          const readied = new Set<string>();
          const ready = (key: string, make: () => Promise<unknown>) => {
            if (readied.has(key)) return;
            readied.add(key);
            readying.push(make().catch(() => {}));
          };
          const cast = parsed.kind === "start" ? [parsed.hero, ...parsed.companions] : [parsed.story.hero, ...parsed.story.companions, ...parsed.story.cast];
          if (reuse.parts) for (const c of cast) if (c && (c.preset || c.svg)) ready(`parts:${c.id}:${c.preset ?? ""}:${(c.svg ?? "").length}`, () => prepareParts(c));
          const readyCharacters = (chars: CharacterDef[], world: string) => {
            if (!reuse.parts) return;
            for (const c of chars) {
              // (a preset's parts; a newcomer with no portrait painted once
              // and kept, then its parts)
              if (c.preset || c.svg) ready(`parts:${c.id}:${c.preset ?? ""}`, () => prepareParts(c));
              else if (world) ready(`new:${c.name}`, () => readyNewcomer(c, world));
            }
          };
          const readyPlaces = (places: StoryPlace[], world: string) => {
            if (!reuse.backdrops || !world) return;
            for (const pl of places) ready(`place:${pl.id}:${pl.light}`, () => prepareBackdrop(pl, world));
          };
          const storyWorld = parsed.kind === "continue" ? parsed.story.world : "";
          for await (const event of streamSegment(parsed, stop.signal)) {
            // (the setting, before the first page: readied at once, kept
            // to the server - the reader's app gets it with the pages)
            if (event.type === "setting") {
              const world = event.world || storyWorld;
              readyPlaces(event.places, world);
              readyCharacters(event.newCharacters, world);
              continue;
            }
            send(event);
            if (event.type === "pages") {
              const world = event.world || storyWorld;
              readyPlaces(event.places ?? [], world);
              readyCharacters(event.newCharacters, world);
            }
            if (event.type === "done") {
              const pages = event.response.segment.pages;
              const world = event.response.world || storyWorld;
              readyCharacters(event.response.newCharacters, world);
              readyPlaces(event.response.places ?? [], world);
              count({
                stories_started: parsed.kind === "start" ? 1 : 0,
                segments: 1,
                pages: pages.length,
                words: pages.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0),
                stories_finished: event.response.ending ? 1 : 0,
              });
            }
          }
        }
        if (stop.signal.aborted) await gen.end("left", { error: "The reader left before it was written." });
        else if (made.v) {
          // (written and sent: credits held for it are now spent)
          await g.settle({ storyKey: made.ticket ?? undefined, title: parsed.kind === "start" ? undefined : (parsed.story as { title?: string }).title });
          await gen.end("ok", made.v);
        }
      } catch (err) {
        if (!stop.signal.aborted && !(err instanceof StoryRefusal)) await reportError("story writing", err, { kind: parsed.kind });
        // (a story that failed to write doesn't count; one the reader
        // walked away from gets its credits back but stays counted)
        await g.release({ left: stop.signal.aborted });
        const data = (await errorResponse(err).json().catch(() => ({}))) as { error?: string };
        const left = stop.signal.aborted;
        send({ type: "error", error: data.error || "The story got stuck. Let's try again!" });
        await gen.end(left ? "left" : err instanceof StoryRefusal ? "refused" : "error", { error: left ? "The reader left before it was written." : err });
      } finally {
        await gen.end("error", { error: "Ended without an answer." });
        try {
          controller.close();
        } catch {}
      }
    },
  })));
  // (the log's last line is written even if the reader has gone)
  // (and any new characters being readied for reuse, finished after the
  // reader has their pages)
  after(() => gen.done.then(() => Promise.allSettled(readying)));
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
