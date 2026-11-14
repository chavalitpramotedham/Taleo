// Painter test bench (development only; see scripts/rsi/bench.ts).
//   POST {prepare: true}          -> readies the story's characters and places as the
//                                    story flow does (parts, newcomers, backdrops)
//   POST {round, pages:[N,...]}   -> paints those pages exactly as a reader's page is
//                                    painted (the live version), saved to the round
import { writeFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { paintPage, prepareBackdrop, readyNewcomer, reuseOf } from "@/server/claude";
import { prepareParts } from "@/server/paint/parts-maker";
import type { UsageListener } from "@/server/metrics";
import { LIVE } from "@/lib/bench-ways";
import { BUDGET_USD, benchRequest, benchStory, pageFile, readLedger, writeLedger } from "../../../../scripts/rsi/bench";

export const runtime = "nodejs";
export const maxDuration = 800;

const devOnly = () => (process.env.NODE_ENV === "development" ? null : new Response("Not found", { status: 404 }));

/** Which page (or set-up) each model call belongs to. */
const painting = new AsyncLocalStorage<{ round: number; page: number; usd: number }>();
type G = { __taleoUsageListeners?: Set<UsageListener>; __rsiListen?: UsageListener };
const g = globalThis as G;
const listeners: Set<UsageListener> = (g.__taleoUsageListeners ??= new Set());
// (a reload of this module replaces its listener rather than adding another)
if (g.__rsiListen) listeners.delete(g.__rsiListen);
g.__rsiListen = (c) => {
  const at = painting.getStore();
  if (!at) return;
  const l = readLedger();
  l.spentUsd = Math.round((l.spentUsd + c.usdMicro / 1e6) * 1e6) / 1e6;
  l.calls.push({ at: new Date().toISOString(), round: at.round, page: at.page, label: c.label, model: c.model, usd: c.usdMicro / 1e6 });
  writeLedger(l);
  at.usd += c.usdMicro / 1e6;
};
listeners.add(g.__rsiListen);

/** As the Plus and Pro plans: the first two pages of each part go to the
 *  quick painter (see app/api/illustrate). */
const QUICK_PAGES = 2;

export async function POST(req: Request) {
  const no = devOnly();
  if (no) return no;
  const body = (await req.json()) as { prepare?: boolean; round?: number; pages?: number[]; effort?: "low" | "medium" | "high" };
  if (readLedger().spentUsd >= BUDGET_USD) return Response.json({ error: `Budget of $${BUDGET_USD} reached` }, { status: 402 });

  if (body.prepare) {
    const story = benchStory();
    const at = { round: body.round ?? -1, page: 0, usd: 0 };
    const out = await painting.run(at, async () => {
      const parts = await Promise.all([story.hero, ...story.companions].map(async (c) => [c.name, await prepareParts(c).catch((e) => String(e))] as const));
      const newcomers = await Promise.all(story.cast.map(async (c) => [c.name, await readyNewcomer(c, story.world).then(() => "ok").catch((e) => String(e))] as const));
      const places = await Promise.all(story.places.map(async (p) => [p.id, await prepareBackdrop(p, story.world).catch((e) => String(e))] as const));
      return { parts, newcomers, places };
    });
    return Response.json({ ...out, usd: at.usd, ledger: readLedger().spentUsd, live: LIVE.code, reuse: reuseOf({}) });
  }

  const round = body.round ?? 0;
  const results: Record<number, { ok: boolean; usd: number; error?: string; chars?: number }> = {};
  await Promise.all(
    (body.pages ?? []).map((n) => {
      const at = { round, page: n, usd: 0 };
      return painting.run(at, async () => {
        const r = benchRequest(n);
        r.quick = (r.pageInPart ?? 0) < QUICK_PAGES;
        // (a candidate: the live settings with the composer's effort changed)
        if (body.effort) r.reuse = { ...LIVE.settings, painter: { ...LIVE.settings.painter!, effort: body.effort } };
        const notes: Record<string, unknown> = {};
        let svg = "";
        try {
          for await (const s of paintPage(r, undefined, notes)) svg += s;
          writeFileSync(pageFile(round, "live", n), svg);
          writeFileSync(pageFile(round, "live", n).replace(/\.svg$/, ".notes.json"), JSON.stringify(notes, null, 1));
          results[n] = { ok: true, usd: at.usd, chars: svg.length };
        } catch (err) {
          results[n] = { ok: false, usd: at.usd, error: err instanceof Error ? err.message : String(err) };
        }
      });
    }),
  );
  return Response.json({ results, ledger: readLedger().spentUsd });
}
