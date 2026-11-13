import { after, NextResponse } from "next/server";
import { hasApiKey, paintPage, paintsInLayers, RESTART, reuseOf, SlowPainter, StoryRefusal } from "@/server/claude";
import { reportError } from "@/server/alerts";
import { parseIllustrateRequest } from "@/server/validate";
import { composePainting } from "@/lib/art/compose";
import { guard } from "@/server/limits";
import { limitsFor, tierFor } from "@/lib/tiers";
import { inLegacyGrace, pageIsSigned } from "@/server/tickets";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { count, withMetricsUser } from "@/server/metrics";
import { auth } from "@/server/auth";
import { beginGen, logDenied } from "@/server/genlog";
import type { ReuseSettings } from "@/lib/types";
import { saveBenchResult } from "@/server/bench";
import { BENCH_WAYS as CURRENT_WAYS, variantOf, type BenchSlot, SLOT_RE } from "@/lib/bench-ways";
import { partsInFlight } from "@/server/paint/parts-maker";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Streams one painted page as raw SVG markup. The stream ends with a marker
 * comment so the browser knows whether the painting finished:
 *   <!--taleo:done-->  or  <!--taleo:error-->
 */
export async function POST(req: Request) {
  const parsed = parseIllustrateRequest(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Nothing to paint." }, { status: 400 });
  // (for the activity log: which of the ways below let the page through)
  let allowedAs: string | null = null;
  // The admin's comparison bench (/admin/lab) paints the same page the
  // ordinary way and from reused pieces, side by side: which one this is.
  // Honoured for the admin only (checked below, by the records).
  const lab = req.headers.get("x-taleo-paint-lab");
  const g = await guard(async (session) => {
    // Only the storyteller's own pages are painted: the page must carry the
    // signature it was given when it was written for this account...
    if (!limitsFor(session.user).verified || pageIsSigned(session.user.id, parsed.page, parsed.sig)) return "illustrate";
    // ...or be a page of a book this account already has in the library
    // (books from before pages were signed, being repainted)...
    if (parsed.storyId) {
      const book = await getGalleryStory(parsed.storyId).catch(() => null);
      if (book?.authorId === session.user.id && allPages(book).some((p) => p.text === parsed.page.text)) {
        allowedAs = "a page of a library book";
        return "illustrate";
      }
    }
    // ...or, for a short while, a story begun before signing existed.
    if (inLegacyGrace()) {
      allowedAs = "unsigned page (grace period)";
      return "illustrate";
    }
    return NextResponse.json({ error: "That page can't be painted." }, { status: 403 });
  });
  // (for the activity log: what was asked, of which painter, and which of
  // the ways a page can be painted this one was. `painter` is false for a
  // request turned away before a painter was chosen.)
  const logged = (user: { id: string } | undefined, tier?: string, painter = true) => ({
    kind: "painting" as const,
    sub: parsed.pageInPart === undefined ? "a page" : `page ${parsed.pageInPart + 1} of its part`,
    what: parsed.page.text,
    cases: [
      parsed.retry ? "second go" : "first go",
      // (a page with no picture when its story was opened, not one written
      // while it was open: worth a look if it had been painted before)
      req.headers.get("x-taleo-reopened") === "1" && "story reopened",
      painter && (parsed.quick ? "quick painter" : "main painter"),
      painter && (paintsInLayers(parsed) ? "in layers" : "one painter"),
      parsed.cast.length ? `${parsed.cast.length} ${parsed.cast.length === 1 ? "character" : "characters"}` : "nobody on the page",
      parsed.page.action ? "with an action" : "no action",
      allowedAs,
      parsed.reuse && `bench: way ${lab}`,
      !parsed.reuse && reuseOf(parsed).stamps && "reused pieces",
    ].filter((c): c is string => Boolean(c)),
    userId: user?.id ?? null,
    tier,
    storyId: parsed.storyId,
    req,
    request: parsed,
    mock: !hasApiKey(),
  });
  if (!g.ok) {
    await logDenied(logged((await auth())?.user, undefined, false), g.response);
    return g.response;
  }
  // The bench's four ways, from nothing reused to everything (see BENCH_WAYS).
  const way = BENCH_WAYS[lab ?? ""];
  const benched = Boolean(way) && g.session.user.isAdmin;
  if (benched) {
    parsed.reuse = way;
    parsed.bench = true;
    // (a current way's own variant; an older name keeps its own name)
    parsed.benchVariant = SLOT_RE.test(lab ?? "") ? variantOf(lab as BenchSlot) : `old-${lab}`;
  } else {
    // (where a page is set steers its painting: until that's part of a
    // page's signature, only the bench may say)
    parsed.place = null;
    parsed.camera = null;
  }
  // The quick painter takes the pages a reader waits on at the start of each
  // part (the story's beginning, and after every decision) - how many is
  // set by the plan; the rest get the main painter.
  const quickPages = limitsFor(g.session.user).quickPages;
  // A second go at a page (its first painting failed, or stalled and was
  // given up on) goes to the quick painter too: whatever troubled the main
  // one, the reader has waited long enough, and it costs less.
  parsed.quick = parsed.retry === true || (parsed.pageInPart !== undefined && parsed.pageInPart < quickPages);

  // If the reader leaves (closes the tab, moves to another page), stop the
  // model straight away: nobody will receive the rest, so finishing it
  // would only spend tokens on a result that's thrown away.
  // A bench painting is the exception: it finishes, and saves its own
  // result to its run (below), even if the bench page is closed or the
  // phone sleeps - its result is the point of painting it.
  const benchRun = benched ? (req.headers.get("x-taleo-bench-run") ?? "") : "";
  const benchSaves = /^[\w-]{3,80}$/.test(benchRun) && SLOT_RE.test(lab ?? "");
  const stop = new AbortController();
  if (!benchSaves) req.signal.addEventListener("abort", () => stop.abort(), { once: true });
  let firstSent = 0;
  let finished = 0;
  const began = Date.now();
  const encoder = new TextEncoder();
  const gen = beginGen(logged(g.session.user, tierFor(g.session.user).name));
  let svg = "";
  const body = withMetricsUser(g.session.user.id, () => gen.run(() => new ReadableStream<Uint8Array>({
    cancel() {
      if (!benchSaves) stop.abort();
    },
    async start(controller) {
      const send = (s: string) => {
        if (stop.signal.aborted) return;
        firstSent ||= Date.now() - began;
        gen.sent(s.length);
        // (a bench page that has gone away: the painting goes on regardless)
        try {
          controller.enqueue(encoder.encode(s));
        } catch {}
      };
      const paint = (s: string) => {
        // (painted from reused pieces, it went wrong part-way: what was
        // sent is thrown away and the page comes again, painted the
        // ordinary way)
        if (s === RESTART) {
          svg = "";
          send("\n<!--taleo:restart-->\n");
          return;
        }
        svg += s;
        send(s);
      };
      const notes: Record<string, unknown> = {};
      const shapes = () => `${(svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/g) || []).length} shapes`;
      try {
        if (!hasApiKey()) {
          // Demo mode: compose the picture and "paint" it in a few strokes.
          const chunks = composePainting(parsed.page, parsed.cast).split(/(?=<g )/);
          for (const c of chunks) {
            paint(c);
            await new Promise((r) => setTimeout(r, 220));
          }
        } else {
          for await (const delta of paintPage(parsed, stop.signal, notes)) paint(delta);
        }
        const left = stop.signal.aborted;
        if (!left) finished = Date.now() - began;
        send("\n<!--taleo:done-->");
        // (the bench's token counts, made after the painting finished, are
        // waited for only now, for the record)
        await Promise.all(Object.values((notes.painters ?? {}) as Record<string, { measuring?: Promise<void> }>).map((l) => l?.measuring)).catch(() => {});
        if (hasApiKey()) count({ paintings: 1, paintings_quick: parsed.quick ? 1 : 0 });
        // (a reader who left got no picture, whatever was painted)
        await gen.end(left ? "left" : "ok", { summary: `${left ? `${shapes()} painted before the reader left` : shapes()}${reuseNote(notes)}`, result: svg });
      } catch (err) {
        // (a painter too slow to begin isn't a failure to report: the page
        // is asked for again at once and the quick painter takes it)
        const slow = err instanceof SlowPainter;
        if (!stop.signal.aborted) count(slow ? { paintings_slow: 1 } : { paintings_failed: 1 });
        console.error("illustration failed", err);
        const left = stop.signal.aborted;
        if (!left && !slow && !(err instanceof StoryRefusal)) await reportError("painting", err);
        send("\n<!--taleo:error-->");
        await gen.end(left ? "left" : slow ? "slow" : err instanceof StoryRefusal ? "refused" : "error", {
          error: left ? "The reader left (or their page gave up waiting) before it finished." : err,
          summary: `${shapes()} painted`,
          result: svg || undefined,
        });
      } finally {
        await gen.end("error", { error: "Ended without an answer." });
        try {
          controller.close();
        } catch {}
      }
    },
  })));
  // (the log's last line is written even if the reader has gone)
  // (and any character's parts still being made, so they're kept)
  after(() => partsInFlight());
  after(() =>
    gen.done.then(async () => {
      if (!benchSaves) return;
      await saveBenchResult(benchRun, lab!, { variant: variantOf(lab as BenchSlot), genId: gen.id, ok: finished > 0 && svg.length > 0, firstMs: firstSent, totalMs: finished || Date.now() - began, svg }).catch((e) => console.warn("bench: couldn't save the result", e));
    }),
  );

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      // (the bench reads the painting's record back, for its tokens and times)
      ...(benched ? { "x-taleo-gen": gen.id } : {}),
    },
  });
}

/** The bench's ways to paint a page: 1 as today; 2 standard scenery
 *  pieces; 3 those and characters from their kept parts; 4 everything -
 *  and each place painted once, reused under every page set there. */
/** The bench's ways (see lib/bench-ways), and older names kept for
 *  anything still using them. */
const BENCH_WAYS: Record<string, ReuseSettings> = {
  ...CURRENT_WAYS,
  b: { stamps: true, parts: true, backdrops: true, painter: { model: "claude-sonnet-5-5", effort: "medium", unthinking: false } },
  "2": { stamps: true, parts: false, backdrops: false },
  "3": { stamps: true, parts: true, backdrops: false },
  "4": { stamps: true, parts: true, backdrops: true },
  old: { stamps: false, parts: false, backdrops: false },
  new: { stamps: true, parts: false, backdrops: false },
};

/** What reuse did on a page, for its line in the activity log. */
function reuseNote(notes: Record<string, unknown>): string {
  const r = notes.reuse as { stamps: number; scatter: number; moved: number; bareInk: number } | undefined;
  const failed = typeof notes.reuseFailed === "string" ? ` · reuse failed, painted the ordinary way (${notes.reuseFailed.slice(0, 80)})` : "";
  // (on the bench: each painter's output split into strokes and thinking)
  const painters = (notes.painters ?? {}) as Record<string, { strokeTokens?: number; thinkingTokens?: number }>;
  const split = Object.entries(painters)
    .filter(([, l]) => typeof l?.strokeTokens === "number")
    .map(([who, l]) => ` · ${who}: ${l.strokeTokens!.toLocaleString("en-GB")} strokes + ${(l.thinkingTokens ?? 0).toLocaleString("en-GB")} thinking`)
    .join("");
  const parts = notes.parts as { from: string[]; full: string[]; readyMs: number } | undefined;
  const figs = (notes.reuse as { figIds?: string[] } | undefined)?.figIds ?? [];
  // (characters placed from pre-painted poses aren't drawn from parts at all)
  const spritesNote = typeof notes.sprites === "string" ? ` · ${notes.sprites}` : "";
  const partsNote = spritesNote.includes("placed from") ? spritesNote : (spritesNote + (parts
    ? ` · from parts: ${figs.length} of ${parts.from.length}${parts.from.length > figs.length ? ` (${parts.from.filter((id) => !figs.includes(id)).join(", ")} redrawn in full)` : ""}${parts.full.length ? `; no parts for ${parts.full.join(", ")}` : ""}${parts.readyMs > 1500 ? `; parts ready after ${Math.round(parts.readyMs / 1000)}s` : ""}`
    : ""));
  const place = notes.backdrop ? ` · backdrop ${notes.backdrop}, ${notes.frame}${notes.pageLayer ? `, page layer ${notes.pageLayer}` : ""}` : "";
  const posed = notes.composer ? ` · ${notes.composer}${(notes.reuse as { posed?: number } | undefined)?.posed ? ` (${(notes.reuse as { posed: number }).posed} posed)` : ""}` : "";
  if (!r) return failed + partsNote + posed + place + split;
  return ` · ${r.stamps} pieces, ${r.scatter} scatters${r.moved ? `, ${r.moved} moved out of the characters' space` : ""}${partsNote}${posed}${place}${failed}${split}`;
}
