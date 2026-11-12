"use client";
import { useState } from "react";
import { Painting } from "@/components/art/Painting";
import type { CharacterDef, IllustrateRequest } from "@/lib/types";

export interface LabPage {
  key: string;
  label: string;
  cast: CharacterDef[];
  page: IllustrateRequest["page"];
  previous?: string;
}

type Way = "old" | "new";
interface Call {
  label: string;
  model: string;
  out: number;
  in: number;
  cacheRead: number;
  firstMs?: number;
  totalMs: number;
  usdMicro: number;
}
interface Result {
  svg: string;
  state: "painting" | "done" | "failed";
  startedAt: number;
  firstMs?: number;
  totalMs?: number;
  restarted?: boolean;
  record?: { status: string; summary?: string; calls: Call[]; usdMicro: number; totalMs?: number } | null;
}

const DONE = "<!--taleo:done-->";
const RESTART = "<!--taleo:restart-->";
const ms = (n?: number) => (n === undefined ? "-" : `${(n / 1000).toFixed(1)}s`);
const usd = (micro: number) => `$${(micro / 1e6).toFixed(3)}`;
const outOf = (r?: Result) => r?.record?.calls.reduce((t, c) => t + (c.out || 0), 0) ?? null;

/** The bench: each page painted the ordinary way and from reused pieces. */
export function LabBench({ world, pages }: { world: string; pages: LabPage[] }) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);
  const set = (id: string, r: Partial<Result>) => setResults((all) => ({ ...all, [id]: { ...(all[id] as Result), ...r } }));

  const paint = async (p: LabPage, way: Way) => {
    const id = `${p.key}:${way}`;
    const startedAt = performance.now();
    setResults((all) => ({ ...all, [id]: { svg: "", state: "painting", startedAt } }));
    try {
      const res = await fetch("/api/illustrate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-taleo-paint-lab": way },
        body: JSON.stringify({ world, cast: p.cast, page: p.page, previous: p.previous ?? null, storyId: "labbench" }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const gen = res.headers.get("x-taleo-gen");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      let first: number | undefined;
      let restarted = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        first ??= performance.now() - startedAt;
        const again = text.lastIndexOf(RESTART);
        if (again >= 0) {
          text = text.slice(again + RESTART.length);
          restarted = true;
        }
        set(id, { svg: text.replace(DONE, ""), firstMs: first, restarted });
      }
      const totalMs = performance.now() - startedAt;
      const ok = text.includes(DONE);
      set(id, { svg: text.replace(DONE, ""), state: ok ? "done" : "failed", totalMs });
      // (the painting's record, for its tokens: written as it ends)
      if (gen)
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const rec = await fetch(`/api/admin/gen?id=${encodeURIComponent(gen)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
          if (rec && rec.status !== "running") {
            set(id, { record: rec });
            break;
          }
        }
    } catch {
      set(id, { state: "failed", totalMs: performance.now() - startedAt });
    }
  };
  const paintRow = (p: LabPage) => Promise.all([paint(p, "old"), paint(p, "new")]);
  const paintAll = async () => {
    setBusy(true);
    // (two pages at a time: four paintings at once, two of each way)
    for (let i = 0; i < pages.length; i += 2) await Promise.all(pages.slice(i, i + 2).map(paintRow));
    setBusy(false);
  };

  // totals over the pages painted both ways
  const both = pages.filter((p) => results[`${p.key}:old`]?.record && results[`${p.key}:new`]?.record);
  const sum = (way: Way, pick: (r: Result) => number) => both.reduce((t, p) => t + pick(results[`${p.key}:${way}`]), 0);

  return (
    <div className="container lab">
      <header className="wizard-head">
        <p className="eyebrow">Admin</p>
        <h1>Painting bench</h1>
        <p className="meta">
          Each page is painted the ordinary way (left) and from reused pieces (right), with the same painters. Tokens, cost and times are read back from the activity log. Each run is
          real painting and costs real money - about $0.10-0.20 a picture.
        </p>
        <button type="button" className="btn btn-primary" onClick={paintAll} disabled={busy}>
          {busy ? "Painting..." : "Paint every page both ways"}
        </button>
      </header>

      {both.length > 0 && (
        <section className="panel lab-totals">
          <b>Over {both.length} page{both.length === 1 ? "" : "s"} painted both ways:</b> output tokens {sum("old", (r) => outOf(r) ?? 0).toLocaleString()} → {sum("new", (r) => outOf(r) ?? 0).toLocaleString()} (
          {Math.round((1 - sum("new", (r) => outOf(r) ?? 0) / Math.max(1, sum("old", (r) => outOf(r) ?? 0))) * 100)}% fewer); cost {usd(sum("old", (r) => r.record?.usdMicro ?? 0))} →{" "}
          {usd(sum("new", (r) => r.record?.usdMicro ?? 0))}; time to a finished page {ms(sum("old", (r) => r.totalMs ?? 0) / both.length)} → {ms(sum("new", (r) => r.totalMs ?? 0) / both.length)} on average.
        </section>
      )}

      {pages.map((p) => (
        <section key={p.key} className="panel lab-row">
          <div className="lab-row-head">
            <div>
              <h3>{p.label}</h3>
              <p className="meta">{p.page.picture}</p>
            </div>
            <button type="button" className="btn btn-soft" onClick={() => void paintRow(p)} disabled={busy}>
              Paint both
            </button>
          </div>
          <div className="lab-pair">
            {(["old", "new"] as Way[]).map((way) => {
              const r = results[`${p.key}:${way}`];
              const out = outOf(r);
              return (
                <figure key={way} className="lab-cell">
                  <figcaption>
                    <b>{way === "old" ? "The ordinary way" : "From reused pieces"}</b>
                    {r && <span className={`lab-state ${r.state}`}>{r.state}</span>}
                  </figcaption>
                  <div className="lab-art">{r?.svg ? <Painting svg={r.svg} className="painting" /> : <span className="meta">Not painted yet</span>}</div>
                  {r && (
                    <div className="lab-numbers">
                      <span>First stroke {ms(r.firstMs)} · finished {ms(r.totalMs)}</span>
                      {out !== null && (
                        <span>
                          Output tokens <b>{out.toLocaleString()}</b> · cost {usd(r.record?.usdMicro ?? 0)}
                        </span>
                      )}
                      {r.record?.calls.map((c, i) => (
                        <span key={i} className="lab-call">
                          {c.label}: {c.out.toLocaleString()} out, {c.in.toLocaleString()} in ({c.cacheRead.toLocaleString()} cached), first {ms(c.firstMs)}, {ms(c.totalMs)}
                        </span>
                      ))}
                      {r.record?.summary && <span className="lab-call">{r.record.summary}</span>}
                      {r.restarted && <span className="lab-call">Reuse failed part-way: painted again the ordinary way.</span>}
                    </div>
                  )}
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
