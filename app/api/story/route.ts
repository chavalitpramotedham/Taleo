import { after, NextResponse } from "next/server";
import { hasApiKey, StoryRefusal, streamSegment, type SegmentEvent } from "@/server/claude";
import { reportError } from "@/server/alerts";
import { errorResponse } from "@/server/errors";
import { mockSegment } from "@/server/mock";
import { parseStoryRequest } from "@/server/validate";
import { auth } from "@/server/auth";
import { guard, limitMessage, peekStart, whoIs } from "@/server/limits";
import { limitsFor, tierFor, storyCredits, CREDITS_PER_STORY_MINUTE, FREE_STORY_MINUTES, STORY_CREDITS_RANGE } from "@/lib/tiers";
import { inLegacyGrace, signPage, storyTicket, storyTicketIsValid } from "@/server/tickets";
import type { Page } from "@/lib/types";
import { count, withMetricsUser } from "@/server/metrics";
import { beginGen, logDenied } from "@/server/genlog";
import { BUSY_ELSEWHERE, busyElsewhere, claimStorySession, deviceOf } from "@/server/story-session";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const balance = await me.account.credits();
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
    free = { minutes: FREE_STORY_MINUTES, perMinute: CREDITS_PER_STORY_MINUTE, balance: await me.account.credits().catch(() => null) };
  }
  return NextResponse.json({
    canStart: ok,
    credits,
    free,
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
      return { bucket: "story", credits: storyCredits(parsed.story.minutes) };
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
    storyId: parsed.kind === "start" ? undefined : (parsed.story as { id?: string }).id,
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
  const soFar = parsed.kind === "start" ? { age: parsed.age, minutes: parsed.minutes, theme: parsed.theme, segments: [] } : parsed.story;
  const stamp = (event: SegmentEvent): SegmentEvent => {
    if (event.type === "pages") return { ...event, pages: signed(event.pages) };
    if (event.type !== "done") return event;
    const r = event.response;
    const segment = { ...r.segment, pages: signed(r.segment.pages) };
    const ticket = r.ending ? undefined : storyTicket(userId, { ...soFar, segments: [...soFar.segments, segment] });
    return { ...event, response: { ...r, segment, ticket } };
  };

  // Streams newline-delimited JSON events: {type:"pages"} each time another
  // page is ready (so the reader can start on page 1 while the rest is
  // still being written), then {type:"done"} with the finished segment, or
  // {type:"error"}.
  // If the reader leaves (closes the tab, moves to another page), stop the
  // model straight away: nobody will receive the rest, so finishing it
  // would only spend tokens on a result that's thrown away.
  const stop = new AbortController();
  req.signal.addEventListener("abort", () => stop.abort(), { once: true });
  const encoder = new TextEncoder();
  const body = withMetricsUser(userId, () => gen.run(() => new ReadableStream<Uint8Array>({
    cancel() {
      stop.abort();
    },
    async start(controller) {
      const made: { v: { summary: string; result: string; cases: string[] } | null } = { v: null };
      const send = (event: SegmentEvent | { type: "error"; error: string }) => {
        if (stop.signal.aborted) return;
        const line = JSON.stringify(event.type === "error" ? event : stamp(event)) + "\n";
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
          for await (const event of streamSegment(parsed, stop.signal)) {
            send(event);
            if (event.type === "done") {
              const pages = event.response.segment.pages;
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
          await g.settle();
          await gen.end("ok", made.v);
        }
      } catch (err) {
        if (!stop.signal.aborted && !(err instanceof StoryRefusal)) await reportError("story writing", err, { kind: parsed.kind });
        await g.release(); // a story that failed to write doesn't count
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
  after(() => gen.done);
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
