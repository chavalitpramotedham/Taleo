"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Painting } from "@/components/art/Painting";
import type { CharacterDef, IllustrateRequest } from "@/lib/types";

export interface LabPage {
  key: string;
  label: string;
  cast: CharacterDef[];
  page: IllustrateRequest["page"];
  previous?: string;
  place?: { id: string; about?: string; light?: string } | null;
  camera?: "close" | "mid" | "wide" | null;
  /** one of the admin's own test pages (can be removed) */
  own?: boolean;
}

/** The four ways, from nothing reused to everything. */
const WAYS = [
  { id: "1", name: "Today", about: "Nothing reused: the painters draw everything, as now." },
  { id: "2", name: "Scenery pieces", about: "Trees, clouds, grass, furniture... placed from the standard pieces." },
  { id: "3", name: "+ Character parts", about: "And each character's head and body kept and placed; only faces, limbs and actions drawn." },
  { id: "4", name: "Everything", about: "And each place painted once and reused under every page there, framed anew, with only the page's own foreground and changes painted." },
] as const;
type Way = (typeof WAYS)[number]["id"];

interface Cell {
  svg: string;
  state: "painting" | "done" | "failed";
  usd?: number;
  out?: number;
  totalMs?: number;
  firstMs?: number;
  summary?: string;
  calls?: { label: string; out: number; in: number; cacheRead: number; totalMs: number }[];
  genId?: string;
}
interface Run {
  id: string;
  at: number;
  page: string;
  ways: Record<string, { usd: number; out: number; totalMs: number; firstMs?: number; ok: boolean; genId?: string; summary?: string }>;
  vote?: string;
}
interface Board {
  way: string;
  painted: number;
  wins: number;
  votedRuns: number;
  usd: number | null;
  out: number | null;
  totalMs: number | null;
  firstMs: number | null;
}

const DONE = "<!--taleo:done-->";
const RESTART = "<!--taleo:restart-->";
const secs = (n?: number | null) => (n === undefined || n === null ? "-" : `${(n / 1000).toFixed(1)}s`);
const usd = (n?: number | null) => (n === undefined || n === null ? "-" : `$${n.toFixed(3)}`);
const num = (n?: number | null) => (n === undefined || n === null ? "-" : Math.round(n).toLocaleString());
const newId = (k: string) => `${k.replace(/[^\w-]/g, "").slice(0, 40)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function api(body: object) {
  await fetch("/api/admin/bench", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}

/** The bench: each page painted four ways, voted on, and added up. */
export function LabBench({ world, pages: fixed, choices }: { world: string; pages: LabPage[]; choices: CharacterDef[] }) {
  const [own, setOwn] = useState<LabPage[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [board, setBoard] = useState<Board[]>([]);
  // live cells: run id -> way -> cell
  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>({});
  // the run shown for each page (the latest, unless one is painting)
  const [shown, setShown] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/bench", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) return;
    setRuns(d.runs);
    setBoard(d.leaderboard);
    setOwn((d.pages as LabPage[]).map((p) => ({ ...p, own: true })));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const pages = useMemo(() => [...own, ...fixed], [own, fixed]);
  const latest = (key: string) => runs.find((r) => r.page === key);
  const runFor = (key: string) => shown[key] ?? latest(key)?.id;

  // Pictures of a run painted earlier: from each painting's record.
  const opened = useCallback(
    async (run: Run) => {
      for (const w of Object.keys(run.ways)) {
        const r = run.ways[w];
        if (!r.genId || cells[run.id]?.[w]) continue;
        const d = await fetch(`/api/admin/gen?id=${encodeURIComponent(r.genId)}&picture=1`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        setCells((all) => ({ ...all, [run.id]: { ...all[run.id], [w]: { svg: d?.svg ?? "", state: r.ok ? "done" : "failed", usd: r.usd, out: r.out, totalMs: r.totalMs, firstMs: r.firstMs, summary: r.summary, calls: d?.calls, genId: r.genId } } }));
      }
    },
    [cells],
  );
  useEffect(() => {
    for (const p of pages) {
      const run = runs.find((r) => r.id === runFor(p.key));
      if (run) void opened(run);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, pages]);

  const setCell = (runId: string, way: string, c: Partial<Cell>) => setCells((all) => ({ ...all, [runId]: { ...all[runId], [way]: { ...(all[runId]?.[way] as Cell), ...c } } }));

  /** One way of one page. */
  const paintWay = async (p: LabPage, way: Way, runId: string, book: string) => {
    const began = performance.now();
    setCell(runId, way, { svg: "", state: "painting" });
    let result = { usd: 0, out: 0, totalMs: 0, firstMs: 0, ok: false, genId: undefined as string | undefined, summary: "" };
    try {
      const res = await fetch("/api/illustrate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-taleo-paint-lab": way },
        body: JSON.stringify({ world, cast: p.cast, page: p.page, previous: p.previous ?? null, storyId: book, place: p.place ?? null, camera: p.camera ?? null }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const gen = res.headers.get("x-taleo-gen") ?? undefined;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      let first = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        first ||= performance.now() - began;
        const again = text.lastIndexOf(RESTART);
        if (again >= 0) text = text.slice(again + RESTART.length);
        setCell(runId, way, { svg: text.replace(DONE, ""), firstMs: first });
      }
      const ok = text.includes(DONE);
      const totalMs = performance.now() - began;
      setCell(runId, way, { svg: text.replace(DONE, ""), state: ok ? "done" : "failed", totalMs });
      result = { ...result, ok, totalMs, firstMs: first, genId: gen };
      if (gen)
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          const rec = await fetch(`/api/admin/gen?id=${encodeURIComponent(gen)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
          if (rec && rec.status !== "running") {
            const out = (rec.calls ?? []).reduce((t: number, c: { out: number }) => t + (c.out || 0), 0);
            result = { ...result, usd: (rec.usdMicro ?? 0) / 1e6, out, summary: rec.summary ?? "" };
            setCell(runId, way, { usd: result.usd, out, summary: rec.summary, calls: rec.calls, genId: gen });
            break;
          }
        }
    } catch {
      setCell(runId, way, { state: "failed", totalMs: performance.now() - began });
      result.totalMs = performance.now() - began;
    }
    await api({ kind: "result", runId, way, result });
  };

  /** A page, all four ways at once. `book`: pages painted together share
   *  one book (so a place's backdrop is painted once among them). */
  const paintPage = async (p: LabPage, book = `b${Date.now().toString(36)}`) => {
    const runId = newId(p.key);
    setShown((s) => ({ ...s, [p.key]: runId }));
    await api({ kind: "start", runId, page: p.key, label: p.label });
    await Promise.all(WAYS.map((w) => paintWay(p, w.id, runId, book)));
  };
  const paintAll = async () => {
    setBusy(true);
    const book = `b${Date.now().toString(36)}`;
    // (two pages at a time: eight paintings at once)
    for (let i = 0; i < pages.length; i += 2) await Promise.all(pages.slice(i, i + 2).map((p) => paintPage(p, book)));
    await load();
    setBusy(false);
  };
  const vote = async (runId: string, way: string) => {
    setRuns((rs) => rs.map((r) => (r.id === runId ? { ...r, vote: way } : r)));
    await api({ kind: "vote", runId, way });
    await load();
  };

  const best = (k: "usd" | "totalMs" | "out") => {
    const vals = board.map((b) => b[k]).filter((v): v is number => v !== null);
    return vals.length ? Math.min(...vals) : null;
  };

  return (
    <div className="container lab">
      <header className="wizard-head">
        <h1>Painting bench</h1>
        <p className="meta">Every page is painted four ways - from nothing reused to everything - by the same painters. Vote for the one you like best; the board adds it up. Each painting is real and costs real money (about $0.10-0.25).</p>
      </header>

      <section className="panel lab-board" aria-label="Leaderboard">
        <h3>Leaderboard</h3>
        <div className="lab-board-scroll">
          <table>
            <thead>
              <tr>
                <th>Way</th>
                <th>Votes</th>
                <th>Win rate</th>
                <th>Avg cost</th>
                <th>Avg tokens out</th>
                <th>Avg finished</th>
                <th>Avg first stroke</th>
                <th>Painted</th>
              </tr>
            </thead>
            <tbody>
              {WAYS.map((w) => {
                const b = board.find((x) => x.way === w.id);
                return (
                  <tr key={w.id}>
                    <td>
                      <b>
                        {w.id}. {w.name}
                      </b>
                    </td>
                    <td>{b?.wins ?? 0}</td>
                    <td>{b && b.votedRuns ? `${Math.round((b.wins / b.votedRuns) * 100)}%` : "-"}</td>
                    <td className={b?.usd !== null && b?.usd === best("usd") ? "lab-best" : ""}>{usd(b?.usd)}</td>
                    <td className={b?.out !== null && b?.out === best("out") ? "lab-best" : ""}>{num(b?.out)}</td>
                    <td className={b?.totalMs !== null && b?.totalMs === best("totalMs") ? "lab-best" : ""}>{secs(b?.totalMs)}</td>
                    <td>{secs(b?.firstMs)}</td>
                    <td>{b?.painted ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="lab-ways">
          {WAYS.map((w) => (
            <li key={w.id}>
              <b>
                {w.id}. {w.name}:
              </b>{" "}
              {w.about}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary" onClick={paintAll} disabled={busy}>
          {busy ? "Painting..." : `Paint every page four ways (${pages.length * 4} paintings)`}
        </button>
      </section>

      <NewPage choices={choices} onSaved={load} />

      {pages.map((p) => {
        const runId = runFor(p.key);
        const run = runs.find((r) => r.id === runId);
        const live = runId ? cells[runId] : undefined;
        const voted = run?.vote;
        const history = runs.filter((r) => r.page === p.key);
        return (
          <section key={p.key} className="panel lab-row">
            <div className="lab-row-head">
              <div>
                <h3>{p.label}</h3>
                <p className="meta">{p.page.picture}</p>
                <p className="meta lab-tags">
                  {p.cast.map((c) => c.name).join(", ") || "nobody"}
                  {p.place ? ` · place: ${p.place.id}` : ""}
                  {p.camera ? ` · ${p.camera} shot` : ""}
                  {history.length > 1 ? ` · ${history.length} runs` : ""}
                </p>
              </div>
              <div className="lab-row-btns">
                <button type="button" className="btn btn-soft" onClick={() => void paintPage(p)} disabled={busy}>
                  Paint four ways
                </button>
                {p.own && (
                  <button type="button" className="link-btn" onClick={() => void api({ kind: "forget-page", key: p.key }).then(load)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {history.length > 1 && (
              <div className="lab-history">
                {history.slice(0, 8).map((r, i) => (
                  <button key={r.id} type="button" className={`lab-chip${r.id === runId ? " on" : ""}`} onClick={() => setShown((s) => ({ ...s, [p.key]: r.id }))}>
                    Run {history.length - i}
                    {r.vote ? ` · ★${r.vote}` : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="lab-four">
              {WAYS.map((w) => {
                const c = live?.[w.id];
                const saved = run?.ways[w.id];
                return (
                  <figure key={w.id} className={`lab-cell${voted === w.id ? " voted" : ""}`}>
                    <figcaption>
                      <b>
                        {w.id}. {w.name}
                      </b>
                      {c && <span className={`lab-state ${c.state}`}>{c.state}</span>}
                    </figcaption>
                    <div className="lab-art">{c?.svg ? <Painting svg={c.svg} className="painting" /> : <span className="meta">{runId ? "..." : "Not painted yet"}</span>}</div>
                    {(c || saved) && (
                      <div className="lab-numbers">
                        <span>
                          <b>{usd(c?.usd ?? saved?.usd)}</b> · {num(c?.out ?? saved?.out)} tokens out
                        </span>
                        <span>
                          first {secs(c?.firstMs ?? saved?.firstMs)} · finished {secs(c?.totalMs ?? saved?.totalMs)}
                        </span>
                        {c?.calls?.map((k, i) => (
                          <span key={i} className="lab-call">
                            {k.label}: {k.out.toLocaleString()} out, {k.in.toLocaleString()} in ({k.cacheRead.toLocaleString()} cached), {secs(k.totalMs)}
                          </span>
                        ))}
                        {(c?.summary ?? saved?.summary) && <span className="lab-call">{c?.summary ?? saved?.summary}</span>}
                      </div>
                    )}
                    {run && (c?.state === "done" || saved?.ok) && (
                      <button type="button" className={`btn ${voted === w.id ? "btn-primary" : "btn-soft"} lab-vote`} onClick={() => void vote(run.id, w.id)}>
                        {voted === w.id ? "★ Best" : "Vote best"}
                      </button>
                    )}
                  </figure>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** A test page of the admin's own. */
function NewPage({ choices, onSaved }: { choices: CharacterDef[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [picture, setPicture] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState("");
  const [placeAbout, setPlaceAbout] = useState("");
  const [light, setLight] = useState("day");
  const [camera, setCamera] = useState("mid");
  const [word, setWord] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : p.length < 4 ? [...p, key] : p));
  const save = async () => {
    if (!text.trim() || !picture.trim()) return;
    setSaving(true);
    // (the first picked is the hero, the rest friends)
    const cast = picked.map((key, i) => {
      const c = choices.find((x) => x.id === key)!;
      return { ...c, id: i === 0 ? "hero" : `friend${i}` };
    });
    const ids = cast.map((c) => c.id);
    const tgt = target.trim();
    const targetId = tgt ? (cast.find((c) => c.name.toLowerCase() === tgt.toLowerCase())?.id ?? tgt) : ids[0];
    const page: LabPage = {
      key: `own-${Date.now().toString(36)}`,
      label: label.trim() || text.trim().slice(0, 50),
      cast,
      page: { text: text.trim(), picture: picture.trim(), characters: ids, action: word.trim() && targetId ? { word: word.trim(), target: targetId, sound: "pop", motion: "bounce" } : null },
      place: placeId.trim() ? { id: placeId.trim(), about: placeAbout.trim() || undefined, light } : null,
      camera: camera as LabPage["camera"],
    };
    await api({ kind: "page", page });
    setSaving(false);
    setOpen(false);
    setLabel("");
    setText("");
    setPicture("");
    setPicked([]);
    setWord("");
    setTarget("");
    onSaved();
  };
  return (
    <section className="panel lab-new">
      <button type="button" className="link-btn" onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : "+ Add a test page of your own"}
      </button>
      {open && (
        <div className="lab-form">
          <label>
            Name (for you)
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Bedtime in the burrow" />
          </label>
          <label>
            The page&apos;s words
            <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pip yawned and snuggled under the blanket." />
          </label>
          <label>
            The picture to paint
            <textarea className="input" rows={3} value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="A mid shot inside a cosy burrow at night: Pip in a little bed, yawning, a lamp glowing..." />
          </label>
          <div>
            <p className="meta">Characters (the first you pick is the hero; up to 4)</p>
            <div className="lab-picks">
              {choices.map((c) => (
                <button key={c.id} type="button" className={`lab-chip${picked.includes(c.id) ? " on" : ""}`} onClick={() => toggle(c.id)}>
                  {picked.includes(c.id) ? `${picked.indexOf(c.id) + 1}. ` : ""}
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="lab-form-row">
            <label>
              Tap word
              <input className="input" value={word} onChange={(e) => setWord(e.target.value)} placeholder="yawned" />
            </label>
            <label>
              Tap target (a name, or a thing)
              <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="the hero, or e.g. lamp" />
            </label>
          </div>
          <div className="lab-form-row">
            <label>
              Place (same name = same place)
              <input className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)} placeholder="burrow" />
            </label>
            <label>
              Light
              <select className="input" value={light} onChange={(e) => setLight(e.target.value)}>
                {["day", "golden", "dusk", "night", "rain"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Camera
              <select className="input" value={camera} onChange={(e) => setCamera(e.target.value)}>
                {["close", "mid", "wide"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            The place, as it always is (its landmarks and which side each is on)
            <textarea className="input" rows={2} value={placeAbout} onChange={(e) => setPlaceAbout(e.target.value)} placeholder="A round burrow room: a little bed on the left, a round window on the right, a rag rug in the middle." />
          </label>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !text.trim() || !picture.trim()}>
            {saving ? "Saving..." : "Add this page"}
          </button>
        </div>
      )}
    </section>
  );
}
