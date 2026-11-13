"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ESTIMATES } from "@/lib/bench-estimates";
import { SPRITE_POSE_IDS } from "@/lib/art/sprites";
import {
  legacyVariant,
  rankPoints,
  variantOf,
  type BenchSlot,
} from "@/lib/bench-ways";
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
  /** when it was added (own and generated pages), for newest first */
  createdAt?: number;
  /** written by the model ("Generate more cases") */
  generated?: boolean;
}

/** The four ways, from nothing reused to everything. */
/** The four ways, and exactly what each one changes. (The ids are kept
 *  in the saved runs, so a way that changes gets a new id.) */
const WAYS = [
  {
    id: "1",
    name: "Today",
    about: "Nothing reused: the painters draw everything, as now.",
    vars: [
      ["Scenery", "Sonnet 5.5, low effort, no thinking - draws all of it"],
      ["Characters", "Opus 5.5, low effort, thinks first - draws all of them"],
      ["Pieces", "none"],
      ["Backdrop", "none: painted afresh on every page"],
    ],
  },
  {
    id: "p",
    name: "Parts + pieces",
    about:
      "Each character's head and body kept and placed; the painter draws only faces, limbs and actions. Scenery placed from the standard pieces.",
    vars: [
      [
        "Scenery",
        "Sonnet 5.5, low effort, no thinking - places pieces, draws the rest",
      ],
      [
        "Characters",
        "Opus 5.5, low effort, thinks first - draws faces, limbs, held things",
      ],
      ["Pieces", "on (scenery, props, effects)"],
      ["Backdrop", "none: painted afresh on every page"],
    ],
  },
  {
    id: "q",
    name: "Parts + backdrop, quick",
    about:
      "Each character's head and body reused, and drawn on by a quick painter that doesn't think first (faces, limbs, actions, what they hold). The place is painted once and reused; the page's own sky and foreground are made in code.",
    vars: [
      [
        "Scenery",
        "the place's backdrop, painted once per place and light (shown stroke by stroke on the page that paints it); this page's sky and foreground made in code (no painter)",
      ],
      [
        "Characters",
        "Sonnet 5.5, low effort, no thinking - draws faces, limbs, held things onto the kept heads and bodies; places standard pieces for what they touch (the tree climbed, the log sat on)",
      ],
      [
        "Prepared ahead",
        "characters' parts (Prepare characters); each place's backdrop, painted by the first page set there and reused by the rest",
      ],
      ["Pieces", "on (scenery, props, effects)"],
      ["Backdrop", "on: reused, zoomed and panned per page"],
      [
        "Replaces",
        "the first way 3 (Sonnet at medium, thinking first), which cost more than today",
      ],
    ],
  },
  {
    id: "x",
    name: "Extreme reuse",
    about:
      "Almost nothing drawn: the place is reused, the page's sky and foreground are made in code, and the characters are put together entirely from the pose library - a cheap composer only writes where everyone stands, their pose, mood and what they hold.",
    vars: [
      [
        "Scenery",
        "the place's backdrop, painted once per place and light; this page's sky and foreground made in code (no painter)",
      ],
      [
        "Characters",
        "Haiku 5.5, low effort, no thinking - writes one tag per character (pose, mood, held thing) plus a few pieces; nothing drawn",
      ],
      ["Pieces", "on, including props and action effects"],
      ["Backdrop", "on: reused, zoomed and panned per page"],
      [
        "If a character has no parts",
        "the composer can't pose it, so it's drawn by the same quick painter for that page",
      ],
    ],
  },
  {
    id: "s",
    name: "Pre-painted poses",
    about:
      "Each character is painted once, ahead, in ten poses (standing, walking, running, jumping, sitting, waving, pointing, holding out, asleep, surprised) and kept. On each page a cheap composer picks a pose for each character, places and sizes them, and adds the pieces the moment needs. Hand-painted characters at almost no cost per page.",
    vars: [
      [
        "Scenery",
        "the place's backdrop, painted once per place and light; this page's sky and foreground made in code (no painter)",
      ],
      [
        "Characters",
        "pre-painted poses (Prepare poses: Sonnet 5.5 at medium, once per character and pose); placed by Haiku 5.5, low effort, no thinking",
      ],
      ["Pieces", "on, including props at the hands and action effects"],
      ["Backdrop", "on: reused, zoomed and panned per page"],
      [
        "If a character's poses aren't ready",
        "it falls back to way 4's assembled figures for that page (the card says so)",
      ],
    ],
  },
] as const;
const nOf = (id?: string) => {
  const i = WAYS.findIndex((w) => w.id === id);
  return i < 0 ? "" : String(i + 1);
};
type Way = (typeof WAYS)[number]["id"];

interface Cell {
  svg: string;
  state: "painting" | "done" | "failed";
  usd?: number;
  out?: number;
  totalMs?: number;
  firstMs?: number;
  summary?: string;
  calls?: {
    label: string;
    out: number;
    in: number;
    cacheRead: number;
    totalMs: number;
  }[];
  genId?: string;
  /** when it was asked for (Date.now()), for the wait bar */
  startedAt?: number;
}
interface Run {
  id: string;
  at: number;
  page: string;
  ways: Record<
    string,
    {
      usd: number;
      out: number;
      totalMs: number;
      firstMs?: number;
      ok: boolean;
      genId?: string;
      summary?: string;
      error?: string;
      setupUsd?: number;
      variant?: string;
    }
  >;
  vote?: string;
  rank?: string[];
}
interface Board {
  way: string;
  painted: number;
  wins: number;
  votedRuns: number;
  score: number;
  usd: number | null;
  out: number | null;
  totalMs: number | null;
  firstMs: number | null;
  setupUsd?: number;
  variant: string;
  /** a slot's variant as it paints now (the others are earlier ones) */
  current: boolean;
  firstAt: number | null;
}

const DONE = "<!--taleo:done-->";
const RESTART = "<!--taleo:restart-->";
const secs = (n?: number | null) =>
  n === undefined || n === null ? "-" : `${(n / 1000).toFixed(1)}s`;
const usd = (n?: number | null) =>
  n === undefined || n === null ? "-" : n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
const num = (n?: number | null) =>
  n === undefined || n === null ? "-" : Math.round(n).toLocaleString();
const newId = (k: string) =>
  `${k.replace(/[^\w-]/g, "").slice(0, 40)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function api(body: object) {
  await fetch("/api/admin/bench", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** The bench: each page painted four ways, voted on, and added up. */
export function LabBench({
  world,
  pages: fixed,
  choices,
}: {
  world: string;
  pages: LabPage[];
  choices: CharacterDef[];
}) {
  const [own, setOwn] = useState<LabPage[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [board, setBoard] = useState<Board[]>([]);
  // live cells: run id -> way -> cell
  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>({});
  // the run shown for each page (the latest, unless one is painting)
  const [shown, setShown] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/bench", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!d) return;
    setRuns(d.runs);
    setBoard(d.leaderboard);
    setOwn((d.pages as LabPage[]).map((p) => ({ ...p, own: true })));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // (newest first: the pages added or generated, by when, then the
  // bench's own fixed ones)
  const pages = useMemo(() => {
    const at = (p: LabPage) =>
      p.createdAt ?? (parseInt(p.key.split("-")[1] ?? "", 36) || 0);
    return [...[...own].sort((a, b) => at(b) - at(a)), ...fixed];
  }, [own, fixed]);
  const latest = (key: string) => runs.find((r) => r.page === key);
  const runFor = (key: string) => shown[key] ?? latest(key)?.id;

  // Pictures of a run painted earlier: from each painting's record.
  const opened = useCallback(
    async (run: Run) => {
      for (const w of Object.keys(run.ways)) {
        const r = run.ways[w];
        if (cells[run.id]?.[w]) continue;
        // (the bench's own copy of the picture first - kept as long as the
        // run; the painting's record has the painters' detail, and is
        // gone after two weeks)
        const [kept, d] = await Promise.all([
          fetch(
            `/api/admin/bench?picture=${encodeURIComponent(run.id)}&way=${w}`,
            { cache: "no-store" },
          )
            .then((x) => (x.ok ? x.json() : null))
            .catch(() => null),
          r.genId
            ? fetch(
                `/api/admin/gen?id=${encodeURIComponent(r.genId)}&picture=1`,
                { cache: "no-store" },
              )
                .then((x) => (x.ok ? x.json() : null))
                .catch(() => null)
            : null,
        ]);
        setCells((all) => ({
          ...all,
          [run.id]: {
            ...all[run.id],
            [w]: {
              svg: kept?.svg || d?.svg || "",
              state: r.ok ? "done" : "failed",
              usd: r.usd,
              out: r.out,
              totalMs: r.totalMs,
              firstMs: r.firstMs,
              summary: r.summary,
              calls: d?.calls,
              genId: r.genId,
            },
          },
        }));
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

  const setCell = (runId: string, way: string, c: Partial<Cell>) =>
    setCells((all) => ({
      ...all,
      [runId]: {
        ...all[runId],
        [way]: { ...(all[runId]?.[way] as Cell), ...c },
      },
    }));

  /** One way of one page. */
  const paintWay = async (
    p: LabPage,
    way: Way,
    runId: string,
    book: string,
  ) => {
    const began = performance.now();
    setCell(runId, way, { svg: "", state: "painting", startedAt: Date.now() });
    let finalSvg = "";
    let result = {
      usd: 0,
      out: 0,
      totalMs: 0,
      firstMs: 0,
      ok: false,
      genId: undefined as string | undefined,
      summary: "",
    };
    try {
      const res = await fetch("/api/illustrate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-taleo-paint-lab": way,
          "x-taleo-bench-run": runId,
        },
        body: JSON.stringify({
          world,
          cast: p.cast,
          page: p.page,
          previous: p.previous ?? null,
          storyId: book,
          place: p.place ?? null,
          camera: p.camera ?? null,
        }),
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
        text = text.replace("<!--taleo:error-->", "");
        const again = text.lastIndexOf(RESTART);
        if (again >= 0) text = text.slice(again + RESTART.length);
        setCell(runId, way, { svg: text.replace(DONE, ""), firstMs: first });
      }
      const ok = text.includes(DONE);
      const totalMs = performance.now() - began;
      setCell(runId, way, {
        svg: text.replace(DONE, ""),
        state: ok ? "done" : "failed",
        totalMs,
      });
      finalSvg = text.replace(DONE, "");
      result = { ...result, ok, totalMs, firstMs: first, genId: gen };
      if (gen)
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          const rec = await fetch(
            `/api/admin/gen?id=${encodeURIComponent(gen)}`,
            { cache: "no-store" },
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          if (rec && rec.status !== "running") {
            const out = (rec.calls ?? []).reduce(
              (t: number, c: { out: number }) => t + (c.out || 0),
              0,
            );
            // (the page's own cost: one-off set-up - a backdrop, a
            // character's parts - is counted apart, as the server saves it)
            const setup = (rec.calls ?? [])
              .filter((c: { label: string }) => SETUP_LABELS.includes(c.label))
              .reduce(
                (t: number, c: { usdMicro?: number }) => t + (c.usdMicro || 0),
                0,
              );
            result = {
              ...result,
              usd: Math.max(0, (rec.usdMicro ?? 0) - setup) / 1e6,
              out,
              summary: rec.summary ?? "",
            };
            setCell(runId, way, {
              usd: result.usd,
              out,
              summary: rec.summary,
              calls: rec.calls,
              genId: gen,
            });
            break;
          }
        }
    } catch {
      setCell(runId, way, {
        state: "failed",
        totalMs: performance.now() - began,
      });
      result.totalMs = performance.now() - began;
    }
    // (the server saves the result and the picture to the run itself, when
    // the painting finishes - even if this page has gone away; reading
    // the runs again picks them up)
    void result;
    void finalSvg;
  };

  /** A page, all four ways at once. `book`: pages painted together share
   *  one book (so a place's backdrop is painted once among them). */
  const paintPage = async (
    p: LabPage,
    book = bookFor(p),
  ) => {
    const runId = newId(p.key);
    setShown((s) => ({ ...s, [p.key]: runId }));
    await api({ kind: "start", runId, page: p.key, label: p.label });
    await Promise.all(WAYS.map((w) => paintWay(p, w.id, runId, book)));
    await load();
  };
  // Ranking a page's ways, best first: tapped in order, saved once every
  // painted way has its place (a vote from before rankings reads as a
  // first place).
  const [picking, setPicking] = useState<Record<string, string[]>>({});
  /** How far a page has got: nothing painted, some ways, all four, or all
   *  four and ranked. */
  const stageOf = (
    run: Run | undefined,
    painting: boolean,
  ): "none" | "some" | "all" | "ranked" => {
    const done = run ? paintedWays(run).length : 0;
    const ranked =
      Boolean(run?.rank?.length) &&
      done === WAYS.length &&
      WAYS.every((w) => run!.rank!.includes(w.id));
    if (!run || done === 0) return painting ? "some" : "none";
    if (done < WAYS.length || painting) return "some";
    return ranked ? "ranked" : "all";
  };
  // A test page's past generations, in a list (its key), and their pictures
  // fetched as the list opens
  const [past, setPast] = useState<string | null>(null);
  const openPast = (key: string) => {
    setPast(key);
    for (const r of runs.filter((x) => x.page === key)) void opened(r);
  };
  // (all test pages, or just those not yet painted all four ways and ranked)
  const [onlyOpen, setOnlyOpen] = useState(false);
  const rankOf = (run: Run | undefined): string[] =>
    run ? (picking[run.id] ?? run.rank ?? (run.vote ? [run.vote] : [])) : [];
  /** A run's result for a slot, only if it was painted by the variant now
   *  in that slot (a slot whose way has changed since shows nothing until
   *  it's painted again); and its picture on the same terms (one painted
   *  in this visit is always current). */
  const currentResult = (run: Run | undefined, slot: string) => {
    const x = run?.ways[slot];
    return x && (x.variant ?? legacyVariant(slot)) === variantOf(slot as BenchSlot) ? x : undefined;
  };
  const staleResult = (run: Run | undefined, slot: string) => (run?.ways[slot] && !currentResult(run, slot) ? run.ways[slot] : undefined);
  const currentCell = (run: Run | undefined, slot: string) => {
    if (!run) return undefined;
    const c = cells[run.id]?.[slot];
    return c && (c.startedAt || !staleResult(run, slot)) ? c : undefined;
  };
  const paintedWays = (run: Run) =>
    WAYS.filter(
      (w) => currentResult(run, w.id)?.ok || currentCell(run, w.id)?.state === "done",
    ).map((w) => w.id);
  const tapRank = async (run: Run, way: string) => {
    const now = rankOf(run);
    const at = now.indexOf(way);
    // (tapped again: it, and the places after it, are taken back)
    const next = at >= 0 ? now.slice(0, at) : [...now, way];
    setPicking((pk) => ({ ...pk, [run.id]: next }));
    if (next.length < paintedWays(run).length) return;
    setRuns((rs) =>
      rs.map((r) => (r.id === run.id ? { ...r, rank: next } : r)),
    );
    await api({ kind: "rank", runId: run.id, order: next });
    await load();
  };

  const best = (k: "usd" | "totalMs" | "out") => {
    const vals = board
      .filter((b) => b.current)
      .map((b) => b[k])
      .filter((v): v is number => v !== null);
    return vals.length ? Math.min(...vals) : null;
  };
  const today = board.find((x) => x.way === "1" && x.current)?.usd ?? null;
  // The leaderboard's order: by code - the order the variants were first
  // tried (#1, #2...; one not tried yet is "new", last) - or by votes.
  const [rankBy, setRankBy] = useState<"code" | "score">("code");
  // (just the four in use now, unless all variants are asked for)
  const [showAll, setShowAll] = useState(false);
  const numbered = [...board]
    .sort(
      (a, b) =>
        (a.firstAt ?? Infinity) - (b.firstAt ?? Infinity) ||
        SLOT_ORDER.indexOf(a.way) - SLOT_ORDER.indexOf(b.way),
    )
    .map((b, i) => ({ b, n: b.firstAt === null ? null : i + 1 }));
  const ranked =
    rankBy === "code"
      ? numbered
      : [...numbered].sort(
          (x, y) =>
            y.b.score - x.b.score ||
            (y.b.votedRuns ? y.b.score / y.b.votedRuns : 0) -
              (x.b.votedRuns ? x.b.score / x.b.votedRuns : 0) ||
            (x.n ?? 1e9) - (y.n ?? 1e9),
        );
  const todayMs =
    board.find((x) => x.way === "1" && x.current)?.totalMs ?? null;
  /** How a variant measures up to its estimate, on cost and on time (each
   *  as a saving against today, in percentage points):
   *  - "off" (red): either falls short by more than 25 points, or costs or
   *    takes more than today where a saving was expected;
   *  - "ahead" (green): neither falls short by more than 10 points, and at
   *    least one beats its estimate by 10 points or more;
   *  - otherwise nothing: near enough to what was expected. */
  const judge = (
    b: Board | undefined,
  ): { kind: "off" | "ahead"; why: string } | null => {
    const est = b && b.way !== "1" ? ESTIMATES[b.way] : undefined;
    if (!b || !est || !b.painted) return null;
    const pc = (v: number | null, base: number | null) =>
      v === null || !base ? null : (1 - v / base) * 100;
    const parts = [
      {
        what: "cost",
        got: pc(b.usd, today),
        want: est.costPc,
        more: "more",
        less: "less",
      },
      {
        what: "time",
        got: pc(b.totalMs, todayMs),
        want: est.timePc,
        more: "longer",
        less: "shorter",
      },
    ].filter(
      (
        x,
      ): x is {
        what: string;
        got: number;
        want: number;
        more: string;
        less: string;
      } => x.got !== null,
    );
    if (!parts.length) return null;
    const say = (x: (typeof parts)[number]) =>
      `${x.what} ${x.got < 0 ? `${Math.round(-x.got)}% ${x.more}` : `${Math.round(x.got)}% ${x.less}`} than today, expected ${x.want}% ${x.less}`;
    const short = parts.filter(
      (x) => (x.want > 0 && x.got < 0) || x.want - x.got > 25,
    );
    if (short.length)
      return {
        kind: "off",
        why: `Far off its estimate: ${short.map(say).join("; ")}`,
      };
    const ahead = parts.filter((x) => x.got - x.want >= 10);
    if (ahead.length && parts.every((x) => x.want - x.got <= 10))
      return {
        kind: "ahead",
        why: `Better than its estimate: ${ahead.map(say).join("; ")}`,
      };
    return null;
  };
  const vsToday = (v?: number | null) =>
    v === undefined || v === null || !today
      ? "-"
      : `${v <= today ? "-" : "+"}${Math.abs(Math.round((1 - v / today) * 100))}%`;

  const [view, setView] = useState<string>("compare");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [openCaps, setOpenCaps] = useState<Record<string, boolean>>({});
  const [spec, setSpec] = useState<string | null>(null);
  // the painting shown full size, and the others it steps through
  const [zoom, setZoom] = useState<{ items: Shown[]; at: number; runId?: string } | null>(null);
  // (always a page's four ways, in order, so ‹ › steps 1, 2, 3, 4)
  const zoomWays = (p: LabPage, runId: string, way: string) => () => {
    const run = runs.find((r) => r.id === runId);
    const today = run?.ways["1"]?.usd ?? cells[runId]?.["1"]?.usd;
    const items = WAYS.map((x): Shown => {
      const c = currentCell(run, x.id) ?? (run ? undefined : cells[runId]?.[x.id]);
      const saved = currentResult(run, x.id);
      const cost = c?.usd ?? saved?.usd;
      const vs =
        x.id !== "1" && cost !== undefined && today
          ? ` · ${cost <= today ? "-" : "+"}${Math.abs(Math.round((1 - cost / today) * 100))}% vs today`
          : "";
      const info =
        c?.state === "painting"
          ? "painting..."
          : cost !== undefined || saved
            ? `${usd(cost)} · ${secs(c?.totalMs ?? saved?.totalMs)} · ${num(c?.out ?? saved?.out)} out${vs}`
            : "";
      const place = rankOf(run).indexOf(x.id);
      return {
        svg: c?.svg ?? "",
        title: `${nOf(x.id)}. ${x.name}`,
        caption: p.label,
        info,
        voted: place === 0,
        slot: x.id,
      };
    });
    setZoom({
      runId,
      items,
      at: Math.max(
        0,
        WAYS.findIndex((x) => x.id === way),
      ),
    });
  };
  const specWay = WAYS.find((w) => w.id === spec);
  const viewing = WAYS.find((w) => w.id === view);
  const paintOne = (p: LabPage) => {
    setOpenRows((o) => ({ ...o, [p.key]: true }));
    void paintPage(p);
  };

  /** One painting's numbers, and the painters' detail folded away. */
  const numbers = (
    c: Cell | undefined,
    saved: Run["ways"][string] | undefined,
  ) => (
    <div className="lab-numbers">
      <span>
        <b>{usd(c?.usd ?? saved?.usd)}</b> ·{" "}
        {secs(c?.totalMs ?? saved?.totalMs)} · {num(c?.out ?? saved?.out)} out
      </span>
      {(c?.calls?.length || c?.summary || saved?.summary) && (
        <details className="lab-more">
          <summary>Details</summary>
          <span>first stroke {secs(c?.firstMs ?? saved?.firstMs)}</span>
          {c?.calls?.map((k, i) => (
            <span key={i} className="lab-call">
              {k.label}: {k.out.toLocaleString()} out, {k.in.toLocaleString()}{" "}
              in ({k.cacheRead.toLocaleString()} cached), {secs(k.totalMs)}
            </span>
          ))}
          {(c?.summary ?? saved?.summary) && (
            <span className="lab-call">{c?.summary ?? saved?.summary}</span>
          )}
        </details>
      )}
    </div>
  );

  return (
    <div className="container lab">
      <header className="lab-head">
        <h1>Painting bench</h1>
        <p className="meta">
          Each page painted every way, from nothing reused to the most. Rank
          them best to worst ({WAYS.map((_, i) => WAYS.length - i).join("-")} points); each painting
          costs real money.
        </p>
      </header>

      <section className="panel lab-board" aria-label="Leaderboard">
        <div
          className="lab-rank"
          role="group"
          aria-label="Rank the leaderboard"
        >
          <span className="lab-rank-group">
            <span className="meta">Rank by</span>
            <button
              type="button"
              className={`lab-chip${rankBy === "code" ? " on" : ""}`}
              onClick={() => setRankBy("code")}
            >
              Index
            </button>
            <button
              type="button"
              className={`lab-chip${rankBy === "score" ? " on" : ""}`}
              onClick={() => setRankBy("score")}
            >
              Score
            </button>
          </span>
          <span className="lab-rank-group">
            <span className="meta">Show</span>
            <button
              type="button"
              className={`lab-chip${!showAll ? " on" : ""}`}
              onClick={() => setShowAll(false)}
            >
              Current
            </button>
            <button
              type="button"
              className={`lab-chip${showAll ? " on" : ""}`}
              onClick={() => setShowAll(true)}
            >
              All ({board.length})
            </button>
          </span>
        </div>
        <div className="lab-board-scroll">
          <table>
            <thead>
              <tr>
                <th>Way</th>
                <th
                  title={`Points from your rankings: ${WAYS.map((_, i) => WAYS.length - i).join("-")} for best to worst (a ranking of fewer ways: as many points as ways for the best)`}
                >
                  Score
                </th>
                <th>Avg cost</th>
                <th>vs today</th>
                <th>Expected</th>
                <th>Avg time</th>
                <th className="lab-wide">Ranked 1st</th>
                <th className="lab-wide">Tokens out</th>
                <th className="lab-wide">First stroke</th>
                <th className="lab-wide">Painted</th>
                <th className="lab-wide">One-off set-up</th>
              </tr>
            </thead>
            <tbody>
              {ranked
                .filter(({ b }) => showAll || b.current)
                .map(({ b, n }) => {
                  const w = WAYS.find((x) => x.id === b.way);
                  const verdict = judge(b);
                  const name =
                    b.way === "b" ? "+ Backdrops, Sonnet" : (w?.name ?? b.way);
                  return (
                    <tr
                      key={b.variant}
                      className={
                        [
                          b.current ? "" : "lab-earlier",
                          verdict
                            ? verdict.kind === "off"
                              ? "lab-off"
                              : "lab-ahead"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                      title={verdict?.why}
                    >
                      <td className="lab-way">
                        <span className="lab-way-name">
                          <b>
                            <span className="lab-order">#{n ?? "new"}</span>{" "}
                            {name}
                            <small className="lab-variant">
                              {b.variant}
                              {b.current ? (
                                <span className="lab-now">
                                  now slot {nOf(b.way)}
                                </span>
                              ) : null}
                            </small>
                          </b>
                          {b.current && w && (
                            <button
                              type="button"
                              className="lab-info"
                              onClick={() => setSpec(w.id)}
                              aria-label={`What ${w.name} changes`}
                            >
                              i
                            </button>
                          )}
                        </span>
                      </td>
                      <td>
                        <b>{b.score}</b>
                        {b.votedRuns > 0 && (
                          <small className="lab-variant">
                            {(b.score / b.votedRuns).toFixed(1)} avg
                          </small>
                        )}
                      </td>
                      <td
                        className={
                          b.current && b.usd !== null && b.usd === best("usd")
                            ? "lab-best"
                            : ""
                        }
                      >
                        {usd(b.usd)}
                      </td>
                      <td>{b.way === "1" ? "-" : vsToday(b.usd)}</td>
                      <td className="lab-est">
                        {b.way !== "1" && ESTIMATES[b.way]
                          ? `-${ESTIMATES[b.way].costPc}%`
                          : "-"}
                      </td>
                      <td
                        className={
                          b.current &&
                          b.totalMs !== null &&
                          b.totalMs === best("totalMs")
                            ? "lab-best"
                            : ""
                        }
                      >
                        {secs(b.totalMs)}
                      </td>
                      <td className="lab-wide">
                        {b.votedRuns ? `${b.wins} of ${b.votedRuns}` : "-"}
                      </td>
                      <td className="lab-wide">{num(b.out)}</td>
                      <td className="lab-wide">
                        {b.firstMs ? secs(b.firstMs) : "-"}
                      </td>
                      <td className="lab-wide">{b.painted}</td>
                      <td className="lab-wide">
                        {b.setupUsd ? usd(b.setupUsd) : "-"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {past &&
        (() => {
          const p = pages.find((x) => x.key === past);
          const list = runs
            .filter((r) => r.page === past)
            .sort((a, b) => b.at - a.at);
          if (!p) return null;
          return (
            <div className="modal-backdrop" onClick={() => setPast(null)}>
              <div
                className="modal-panel draft-prompt lab-past-dialog"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="lab-past-title"
              >
                <div className="modal-head">
                  <h3 id="lab-past-title">{p.label}: past generations</h3>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setPast(null)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <ol className="lab-past-list">
                  {list.map((r, i) => {
                    const order = rankOf(r);
                    const when = new Date(r.at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <li
                        key={r.id}
                        className={r.id === runFor(p.key) ? "on" : undefined}
                      >
                        <div className="lab-past-head">
                          <b>Run {list.length - i}</b>
                          <span className="meta">
                            {when}
                            {order.length
                              ? ` · ranked ${order.map((x) => nOf(x)).join(" > ")}`
                              : " · not ranked"}
                          </span>
                          {r.id !== runFor(p.key) && (
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => {
                                setShown((s) => ({ ...s, [p.key]: r.id }));
                                setOpenRows((o) => ({ ...o, [p.key]: true }));
                                setPast(null);
                              }}
                            >
                              Show this run
                            </button>
                          )}
                        </div>
                        <div className="lab-past-four">
                          {WAYS.map((w) => {
                            const c = cells[r.id]?.[w.id];
                            const saved = r.ways[w.id];
                            return (
                              <figure
                                key={w.id}
                                className={
                                  order[0] === w.id ? "first" : undefined
                                }
                              >
                                <div className="lab-art">
                                  {c?.svg ? (
                                    <button
                                      type="button"
                                      className="lab-zoom"
                                      aria-label={`See ${w.name} full size`}
                                      onClick={zoomWays(p, r.id, w.id)}
                                    >
                                      <Painting
                                        svg={c.svg}
                                        className="painting"
                                      />
                                    </button>
                                  ) : (
                                    <span className="meta">
                                      {saved
                                        ? saved.ok
                                          ? "..."
                                          : "failed"
                                        : "not painted"}
                                    </span>
                                  )}
                                </div>
                                <figcaption>
                                  {nOf(w.id)}
                                  {order.includes(w.id)
                                    ? ` · ${ORDINAL[order.indexOf(w.id)]}`
                                    : ""}
                                  {saved ? ` · ${saved.variant ?? legacyVariant(w.id)}` : ""}
                                  {saved?.ok
                                    ? ` · ${usd(saved.usd)} · ${secs(saved.totalMs)}`
                                    : ""}
                                </figcaption>
                              </figure>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          );
        })()}

      {specWay && (
        <div className="modal-backdrop" onClick={() => setSpec(null)}>
          <div
            className="modal-panel draft-prompt lab-spec-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lab-spec-title"
          >
            <div className="modal-head">
              <h3 id="lab-spec-title">
                {nOf(specWay.id)}. {specWay.name}{" "}
                <small className="lab-variant">{variantOf(specWay.id)}</small>
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSpec(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="meta">{specWay.about}</p>
            <dl className="lab-vars">
              {specWay.vars.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {specWay.id !== "1" && ESTIMATES[specWay.id] && (
              <p className="meta lab-spec-est">
                <b>Expected:</b> {usd(ESTIMATES[specWay.id].usd)} and{" "}
                {secs(ESTIMATES[specWay.id].ms)} a page (
                {ESTIMATES[specWay.id].costPc}% cheaper,{" "}
                {ESTIMATES[specWay.id].timePc}% faster than today).{" "}
                {ESTIMATES[specWay.id].why}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => setSpec(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {zoom && (
        <BenchZoom
          rank={(() => {
            // (ranked from the full-size views too, read live from the run)
            const run = runs.find((r) => r.id === zoom.runId);
            if (!run) return undefined;
            const order = rankOf(run);
            const painted = paintedWays(run);
            const n = Math.max(order.length, painted.length);
            return {
              label: (slot: string) => {
                if (!(painted as string[]).includes(slot)) return null;
                const at = order.indexOf(slot);
                return at >= 0 ? `${ORDINAL[at]} · ${rankPoints(at, n)} ${rankPoints(at, n) === 1 ? "pt" : "pts"}` : `Rank ${ORDINAL[order.length] ?? ""}`;
              },
              on: (slot: string) => order.includes(slot),
              first: order[0],
              tap: (slot: string) => void tapRank(run, slot),
            };
          })()}
          items={zoom.items}
          at={zoom.at}
          onStep={(at) => setZoom((z) => (z ? { ...z, at } : z))}
          onClose={() => setZoom(null)}
        />
      )}

      <nav className="lab-views" aria-label="Show">
        <button
          type="button"
          className={`lab-chip${view === "compare" ? " on" : ""}`}
          onClick={() => setView("compare")}
        >
          Compare all
        </button>
        {WAYS.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`lab-chip${view === w.id ? " on" : ""}`}
            onClick={() => setView(w.id)}
          >
            {nOf(w.id)}. {w.name}
          </button>
        ))}
      </nav>

      {viewing ? (
        <section
          className="lab-gallery"
          aria-label={`Every page, ${viewing.name}`}
        >
          <WaySummary way={viewing.id} runs={runs} />
          <p className="meta lab-gallery-note">
            Every page&apos;s latest painting, way {nOf(viewing.id)} only.
          </p>
          <div className="lab-gallery-grid">
            {pages.map((p) => {
              const run = runs.find((r) => r.id === runFor(p.key));
              const c = currentCell(run, viewing.id);
              const saved = currentResult(run, viewing.id);
              return (
                <figure
                  key={p.key}
                  className={`lab-cell${rankOf(run)[0] === viewing.id ? " voted" : ""}`}
                >
                  <figcaption>
                    <b>{p.label}</b>
                    {rankOf(run).includes(viewing.id) && (
                      <span className="lab-state">
                        {ORDINAL[rankOf(run).indexOf(viewing.id)]}
                      </span>
                    )}
                  </figcaption>
                  <div className="lab-art">
                    {c?.svg ? (
                      <button
                        type="button"
                        className="lab-zoom"
                        aria-label={`See ${p.label} full size`}
                        onClick={zoomWays(p, run!.id, viewing.id)}
                      >
                        <Painting svg={c.svg} className="painting" />
                      </button>
                    ) : c?.state === "painting" && c.startedAt ? (
                      <WaitBar
                        since={c.startedAt}
                        way={viewing.id}
                        board={board}
                      />
                    ) : (
                      <span className="meta">
                        {c?.state === "painting" ? "..." : "Not painted yet"}
                      </span>
                    )}
                  </div>
                  {((c && c.state !== "painting") || saved) &&
                    numbers(c, saved)}
                </figure>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <div className="lab-pages-bar">
            <GenerateCases choices={choices} pages={pages} onSaved={load} />
            <PrepareCharacters choices={choices} />
            <PreparePoses pages={pages} />
            <NewPage choices={choices} onSaved={load} />
            <span
              className="lab-pages-filter"
              role="group"
              aria-label="Which test pages"
            >
              <button
                type="button"
                className={`lab-chip${!onlyOpen ? " on" : ""}`}
                onClick={() => setOnlyOpen(false)}
              >
                All ({pages.length})
              </button>
              <button
                type="button"
                className={`lab-chip${onlyOpen ? " on" : ""}`}
                onClick={() => setOnlyOpen(true)}
              >
                Uncompleted (
                {
                  pages.filter(
                    (q) =>
                      stageOf(
                        runs.find((r) => r.id === runFor(q.key)),
                        false,
                      ) !== "ranked",
                  ).length
                }
                )
              </button>
            </span>
          </div>
          {pages.map((p) => {
            const runId = runFor(p.key);
            const run = runs.find((r) => r.id === runId);
            const live = runId ? cells[runId] : undefined;
            const order = rankOf(run);
            const voted = order[0];
            const history = runs.filter((r) => r.page === p.key);
            const painting = Boolean(
              live && Object.values(live).some((c) => c?.state === "painting"),
            );
            if (onlyOpen && stageOf(run, painting) === "ranked") return null;
            return (
              <details
                key={p.key}
                className="panel lab-row"
                open={Boolean(openRows[p.key])}
                onToggle={(e) => {
                  const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                  setOpenRows((o) =>
                    Boolean(o[p.key]) === isOpen
                      ? o
                      : { ...o, [p.key]: isOpen },
                  );
                }}
              >
                <summary className="lab-row-sum">
                  <span className="lab-row-title">
                    <b className="lab-row-name">
                      {(() => {
                        const stage = stageOf(run, painting);
                        const label = {
                          none: "Not painted",
                          some: "Partly painted",
                          all: "All four painted, not ranked",
                          ranked: "All four painted and ranked",
                        }[stage];
                        return (
                          <span
                            className={`lab-dot ${stage}`}
                            role="img"
                            aria-label={label}
                            title={label}
                          >
                            {stage === "ranked" && (
                              <svg
                                viewBox="0 0 16 16"
                                width="10"
                                height="10"
                                aria-hidden="true"
                              >
                                <path
                                  d="M3.5 8.5 6.5 11.5 12.5 4.5"
                                  fill="none"
                                  stroke="#fff"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                        );
                      })()}
                      <span className="lab-row-label">{p.label}</span>
                    </b>
                    <span className="meta lab-tags">
                      {p.cast.map((c) => c.name).join(", ") || "nobody"}
                      {p.place ? ` · ${p.place.id}` : ""}
                      {p.camera ? ` · ${p.camera}` : ""}
                    </span>
                  </span>
                  <span className="lab-row-status">
                    {painting
                      ? "painting..."
                      : run && run.rank?.length
                        ? `ranked ${run.rank.map((x) => nOf(x)).join(" > ")}`
                        : order.length
                          ? "ranking..."
                          : run
                            ? "not ranked"
                            : "not painted"}
                  </span>
                  <button
                    type="button"
                    className="lab-paint"
                    aria-label="Paint this page every way"
                    title="Paint every way"
                    disabled={painting}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      paintOne(p);
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18.5 3.5a2.1 2.1 0 0 1 3 3L12 16l-4-4z" />
                      <path d="M8 12c-2.5 0-4 1.6-4 4 0 1.6-.7 2.7-2 3.5 3.8.8 8-.4 8-4.5" />
                    </svg>
                  </button>
                </summary>
                <p
                  className={`meta lab-picture${openCaps[p.key] ? " open" : ""}`}
                  onClick={() =>
                    setOpenCaps((o) => ({ ...o, [p.key]: !o[p.key] }))
                  }
                  title={openCaps[p.key] ? undefined : "Show all"}
                >
                  {p.page.picture}
                </p>
                {p.own && (
                  <button
                    type="button"
                    className="link-btn lab-remove"
                    onClick={() =>
                      void api({ kind: "forget-page", key: p.key }).then(load)
                    }
                  >
                    Remove this page
                  </button>
                )}
                <div className="lab-four">
                  {WAYS.map((w) => {
                    const c = run ? currentCell(run, w.id) : live?.[w.id];
                    const saved = currentResult(run, w.id);
                    const stale = staleResult(run, w.id);
                    return (
                      <figure
                        key={w.id}
                        className={`lab-cell${voted === w.id ? " voted" : ""}`}
                      >
                        <figcaption>
                          <b>
                            {nOf(w.id)}. {w.name}
                          </b>
                          {c && c.state !== "done" && (
                            <span className={`lab-state ${c.state}`}>
                              {c.state}
                            </span>
                          )}
                        </figcaption>
                        <div className="lab-art">
                          {c?.svg ? (
                            <button
                              type="button"
                              className="lab-zoom"
                              aria-label={`See ${w.name} full size`}
                              onClick={zoomWays(p, runId!, w.id)}
                            >
                              <Painting svg={c.svg} className="painting" />
                            </button>
                          ) : c?.state === "painting" && c.startedAt ? (
                            <WaitBar
                              since={c.startedAt}
                              way={w.id}
                              board={board}
                            />
                          ) : (
                            <span className="meta">
                              {!runId
                                ? "Not painted yet"
                                : stale && !c
                                  ? `Painted by an earlier version (${stale.variant ?? legacyVariant(w.id)})`
                                  : c?.state === "failed" || saved
                                  ? "No picture"
                                  : run && Date.now() - run.at > 6 * 60_000
                                    ? "Didn't finish"
                                    : "Painting... (saved when done)"}
                            </span>
                          )}
                        </div>
                        {((c && c.state !== "painting") || saved) &&
                          numbers(c, saved)}
                        {saved && !saved.ok && (
                          <p className="lab-error">
                            Failed: {saved.error || "no reason recorded"}
                          </p>
                        )}
                        {run &&
                          c?.state !== "painting" &&
                          !c?.svg &&
                          !saved?.ok &&
                          (c?.state === "failed" ||
                            saved ||
                            stale ||
                            Date.now() - run.at > 6 * 60_000) && (
                            <button
                              type="button"
                              className="btn btn-soft lab-vote"
                              onClick={() =>
                                void paintWay(
                                  p,
                                  w.id,
                                  run.id,
                                  bookFor(p),
                                ).then(load)
                              }
                            >
                              Paint this way
                            </button>
                          )}
                        {run && (c?.state === "done" || saved?.ok) && (
                          <button
                            type="button"
                            className={`btn ${order.includes(w.id) ? "btn-primary" : "btn-soft"} lab-vote`}
                            onClick={() => void tapRank(run, w.id)}
                          >
                            {order.includes(w.id)
                              ? `${ORDINAL[order.indexOf(w.id)]} · ${rankPoints(order.indexOf(w.id), Math.max(order.length, paintedWays(run).length))} ${rankPoints(order.indexOf(w.id), Math.max(order.length, paintedWays(run).length)) === 1 ? "pt" : "pts"}`
                              : `Rank ${ORDINAL[order.length] ?? ""}`}
                          </button>
                        )}
                      </figure>
                    );
                  })}
                </div>
                {(history.length > 1 || Boolean(run?.rank?.length || run?.vote)) && (
                  <div className="lab-card-links">
                    {run && Boolean(run.rank?.length || run.vote) && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={async () => {
                          // (put away, not lost: it still counts for variants no
                          // longer in use - see the bench route)
                          setPicking((pk) => ({ ...pk, [run.id]: [] }));
                          setRuns((rs) => rs.map((r) => (r.id === run.id ? { ...r, rank: undefined, vote: undefined } : r)));
                          await api({ kind: "reset-rank", runId: run.id });
                          await load();
                        }}
                      >
                        Reset ranking
                      </button>
                    )}
                    {history.length > 1 && (
                      <button type="button" className="link-btn" onClick={() => openPast(p.key)}>
                        Past generations ({history.length})
                      </button>
                    )}
                  </div>
                )}
              </details>
            );
          })}
        </>
      )}
    </div>
  );
}

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

/** Slots in bench order, the retired first way 3 ("b") where it stood. */
const SLOT_ORDER = ["1", "p", "b", "q", "x"];

/** The "book" a test page is painted in. Every page set in the same
 *  place shares one, as the pages of a real story do: the first painting
 *  there pays for the place's backdrop and the rest reuse it (each variant
 *  its own - see the illustrate route). */
const bookFor = (p: LabPage) => `lab${(p.place?.id ?? p.key).replace(/[^a-z0-9]/gi, "").slice(0, 36)}`;

/** One-off set-up calls (as server/bench counts them). */
const SETUP_LABELS = ["backdrop painter", "parts maker"];

/** A painting shown full size: which way, and of which page. */
type Shown = {
  svg: string;
  title: string;
  caption: string;
  info?: string;
  voted?: boolean;
  /** which way it is (for ranking from the full-size views) */
  slot?: string;
};
/** Ranking from the full-size views: each way's button label (null: not
 *  rankable, e.g. not painted), whether it's placed, and the tap. */
type ZoomRank = { label: (slot: string) => string | null; on: (slot: string) => boolean; first?: string; tap: (slot: string) => void };

/** The bench's paintings full size, as the activity log shows its own (the
 *  same dialog: ✕, Esc or a tap outside closes it; ‹ ›, the arrow keys or
 *  a sideways swipe step through the others) - drawn as the painting
 *  itself, with its watercolour, not as a flat image. */
function BenchZoom({
  items,
  at,
  onStep,
  onClose,
  rank,
}: {
  items: Shown[];
  at: number;
  onStep: (i: number) => void;
  onClose: () => void;
  rank?: ZoomRank;
}) {
  const rankButton = (slot?: string) => {
    const label = slot && rank ? rank.label(slot) : null;
    if (!slot || !rank || !label) return null;
    return (
      <button type="button" className={`btn ${rank.on(slot) ? "btn-primary" : "btn-soft"} lab-vote lab-zoom-rank`} onClick={() => rank.tap(slot)}>
        {label}
      </button>
    );
  };
  const item = items[at];
  const prev = at > 0 ? () => onStep(at - 1) : undefined;
  const next = at < items.length - 1 ? () => onStep(at + 1) : undefined;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prev) (e.preventDefault(), prev());
      else if (e.key === "ArrowRight" && next) (e.preventDefault(), next());
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, prev, next]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  // (on a big screen, all four at once, 1 2 over 3 4, to compare at a glance)
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px) and (min-height: 600px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  if (!item) return null;
  const stepping = items.length > 1;
  if (wide && items.length >= 4) {
    return createPortal(
      <div className="modal-backdrop lab-collage-backdrop" onClick={onClose}>
        <div
          className="lab-collage"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.caption}: every way`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="lab-collage-head">
            <h3>{item.caption}</h3>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className={`lab-collage-grid${items.length > 4 ? " three" : ""}`}>
            {items.map((x, i) => (
              <figure
                key={i}
                className={`lab-collage-cell${(rank ? rank.first === x.slot : x.voted) ? " voted" : ""}${i === at ? " picked" : ""}`}
              >
                <div className="lab-collage-art">
                  {x.svg ? (
                    <Painting svg={x.svg} className="painting" />
                  ) : (
                    <span className="meta">Not painted yet</span>
                  )}
                </div>
                <figcaption>
                  <b>{x.title}</b>
                  {x.info && <span>{x.info}</span>}
                </figcaption>
                {rankButton(x.slot)}
              </figure>
            ))}
          </div>
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="admin-zoom-wrap" onClick={(e) => e.stopPropagation()}>
        {stepping && (
          <>
            <button
              type="button"
              className="preview-step admin-zoom-step admin-zoom-prev"
              onClick={prev}
              disabled={!prev}
              aria-label="Previous painting"
            >
              ‹
            </button>
            <button
              type="button"
              className="preview-step admin-zoom-step admin-zoom-next"
              onClick={next}
              disabled={!next}
              aria-label="Next painting"
            >
              ›
            </button>
          </>
        )}
        <div
          className="modal-panel admin-zoom-panel"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.title}: ${item.caption}`}
          onTouchStart={(e) =>
            (swipe.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            })
          }
          onTouchEnd={(e) => {
            const from = swipe.current;
            swipe.current = null;
            if (!from || !stepping) return;
            const dx = e.changedTouches[0].clientX - from.x;
            const dy = e.changedTouches[0].clientY - from.y;
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (dx < 0) next?.();
            else prev?.();
          }}
        >
          <div className="modal-head">
            <h3>{item.title}</h3>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="lab-zoom-art">
            {item.svg ? (
              <Painting key={at} svg={item.svg} className="painting" />
            ) : (
              <span className="meta">Not painted yet</span>
            )}
          </div>
          <p className="admin-zoom-caption">{item.caption}</p>
          {rankButton(item.slot)}
          {stepping && (
            <p className="meta admin-zoom-more">
              <span className="admin-zoom-count">
                {at + 1} of {items.length}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Until a way usually shows its first strokes, when nothing's measured
 *  yet (ways 3 and 4 wait for the place's backdrop, and the first time a
 *  character is used, up to 20 s for its parts). */
const FIRST_GUESS_MS: Record<string, number> = {
  "1": 25_000,
  p: 25_000,
  q: 15_000,
  x: 15_000,
  s: 10_000,
};

/** A painting that hasn't shown anything yet: how long it's been, against
 *  how long this way usually takes to show its first strokes. */
function WaitBar({
  since,
  way,
  board,
}: {
  since: number;
  way: string;
  board: Board[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const measured = board.find((b) => b.way === way && b.current)?.firstMs;
  const usual =
    measured && measured > 1000 ? measured : (FIRST_GUESS_MS[way] ?? 30_000);
  const gone = now - since;
  // (fills to the usual time, then creeps on towards the end without
  // reaching it)
  const frac =
    gone <= usual
      ? (gone / usual) * 0.9
      : 0.9 + 0.1 * (1 - Math.exp(-(gone - usual) / usual));
  return (
    <div
      className="lab-wait"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(frac * 100)}
      aria-label="Waiting for the first strokes"
    >
      <div className="lab-wait-track">
        <div
          className="lab-wait-fill"
          style={{ width: `${(frac * 100).toFixed(1)}%` }}
        />
      </div>
      <span>
        {Math.floor(gone / 1000)}s ·{" "}
        {gone > usual
          ? "taking longer than usual"
          : `first strokes in ~${Math.max(1, Math.round((usual - gone) / 1000))}s`}
      </span>
    </div>
  );
}

/** One way's totals over every run, against today's way. */
function WaySummary({ way, runs }: { way: string; runs: Run[] }) {
  const stats = (w: string) => {
    // (only this slot's current variant: its earlier ones painted differently)
    const done = runs
      .map((r) => r.ways[w])
      .filter(
        (x): x is Run["ways"][string] =>
          Boolean(x?.ok) &&
          (x!.variant ?? legacyVariant(w)) === variantOf(w as BenchSlot),
      );
    const costed = done.filter((x) => x.usd > 0);
    const cost = costed.reduce((t, x) => t + x.usd, 0);
    const time = done.reduce((t, x) => t + x.totalMs, 0);
    const setup = done.reduce((t, x) => t + (x.setupUsd ?? 0), 0);
    return {
      n: done.length,
      cost,
      setup,
      avgCost: costed.length ? cost / costed.length : null,
      time,
      avgTime: done.length ? time / done.length : null,
    };
  };
  const me = stats(way);
  const base = way === "1" ? null : stats("1");
  const saving = (mine: number | null, theirs: number | null | undefined) => {
    if (mine === null || !theirs) return null;
    const pc = Math.round((1 - mine / theirs) * 100);
    return pc >= 0 ? `${pc}% less` : `${-pc}% more`;
  };
  const totalTime = (ms: number) =>
    ms >= 60_000
      ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
      : secs(ms);
  const costSave = saving(me.avgCost, base?.avgCost);
  const timeSave = saving(me.avgTime, base?.avgTime);
  const est = way === "1" ? null : ESTIMATES[way];
  return (
    <div className="lab-summary">
      <div className="lab-stat">
        <span>Paintings</span>
        <b>{me.n}</b>
      </div>
      <div className="lab-stat">
        <span>Cost per painting</span>
        <b>{usd(me.avgCost)}</b>
        {base && (
          <em className={costSave?.endsWith("less") ? "good" : ""}>
            {costSave ? `${costSave} than today` : "no baseline yet"}
          </em>
        )}
        {est && (
          <em className="lab-est">
            expected {usd(est.usd)}, {est.costPc}% less
          </em>
        )}
      </div>
      <div className="lab-stat">
        <span>Total cost</span>
        <b>{usd(me.n ? me.cost : null)}</b>
        {me.setup > 0 && <em>plus {usd(me.setup)} one-off set-up</em>}
      </div>
      <div className="lab-stat">
        <span>Time per painting</span>
        <b>{secs(me.avgTime)}</b>
        {base && (
          <em className={timeSave?.endsWith("less") ? "good" : ""}>
            {timeSave ? `${timeSave} than today` : "no baseline yet"}
          </em>
        )}
        {est && (
          <em className="lab-est">
            expected {secs(est.ms)}, {est.timePc}% less
          </em>
        )}
      </div>
      <div className="lab-stat">
        <span>Total painting time</span>
        <b>{me.n ? totalTime(me.time) : "-"}</b>
      </div>
      {base && (
        <div className="lab-stat">
          <span>Today, for comparison</span>
          <b>
            {usd(base.avgCost)} · {secs(base.avgTime)}
          </b>
          <em>per painting, over {base.n}</em>
        </div>
      )}
      {est && (
        <p className="lab-est-why">
          <b>Why we expected this:</b> {est.why}
        </p>
      )}
    </div>
  );
}

/** One generated case as a bench page: its characters matched by name
 *  to the bench's own (the first is the hero, the rest friends). */
type GenCase = {
  label: string;
  text: string;
  picture: string;
  characters: string[];
  place: { id: string; about: string; light: string };
  camera: "close" | "mid" | "wide";
  action: { word: string; target: string } | null;
};
function caseToPage(
  c: GenCase,
  choices: CharacterDef[],
  key: string,
  createdAt: number,
): LabPage {
  const byName = (n: string) =>
    choices.find((x) => x.name.toLowerCase() === n.trim().toLowerCase());
  const cast = [...new Set(c.characters)]
    .map(byName)
    .filter((x): x is CharacterDef => Boolean(x))
    .slice(0, 3)
    .map((x, i) => ({ ...x, id: i === 0 ? "hero" : `friend${i}` }));
  const target = c.action
    ? (cast.find(
        (x) => x.name.toLowerCase() === c.action!.target.trim().toLowerCase(),
      )?.id ?? c.action.target.trim().slice(0, 40))
    : "";
  return {
    key,
    createdAt,
    generated: true,
    label: c.label.slice(0, 80),
    cast,
    page: {
      text: c.text,
      picture: c.picture,
      characters: cast.map((x) => x.id),
      action:
        c.action && target
          ? {
              word: c.action.word.slice(0, 30),
              target,
              sound: "pop",
              motion: "bounce",
            }
          : null,
    },
    place: {
      id: c.place.id.replace(/[^\w-]/g, "-").slice(0, 40) || "place",
      about: c.place.about,
      light: c.place.light,
    },
    camera: c.camera,
  };
}

/** "Prepare poses" (way 5): every test page's characters painted in each
 *  pose, ahead and kept - one pose per request, a few at once, with the
 *  count shown as they're done. Poses already made are found at once. */
function PreparePoses({ pages }: { pages: LabPage[] }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ n: number; of: number; failed: number } | null>(null);
  const go = async () => {
    setBusy(true);
    const chars = [...new Map(pages.flatMap((p) => p.cast).map((c) => [c.name, c])).values()];
    const jobs = chars.flatMap((c) => SPRITE_POSE_IDS.map((pose) => ({ c: { ...c, id: "hero" }, pose })));
    let n = 0;
    let failed = 0;
    setDone({ n: 0, of: jobs.length, failed: 0 });
    const next = async (): Promise<void> => {
      const job = jobs.shift();
      if (!job) return;
      const r = await fetch("/api/admin/bench", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "prepare-pose", character: job.c, pose: job.pose }) })
        .then((x) => x.json())
        .catch(() => null);
      n++;
      if (!r?.ok) failed++;
      setDone({ n, of: n + jobs.length, failed });
      return next();
    };
    await Promise.all(Array.from({ length: 6 }, next));
    setBusy(false);
  };
  return (
    <span className="lab-prepare">
      <button type="button" className="lab-add" onClick={() => void go()} disabled={busy}>
        <span className="lab-add-icon" aria-hidden="true">
          ✎
        </span>
        {busy ? "Preparing poses..." : "Prepare poses"}
      </button>
      {done && (
        <span className="meta">
          {done.n} of {done.of} ready{done.failed ? `, ${done.failed} failed` : ""}
        </span>
      )}
    </span>
  );
}

/** "Prepare characters": every character's parts made ahead and kept,
 *  once for all ways and pages - so no page waits on them, and every way
 *  paints from the same. (A family's character gets its parts as it's
 *  made, once painting from parts is switched on for everyone.) */
function PrepareCharacters({ choices }: { choices: CharacterDef[] }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const go = async () => {
    setBusy(true);
    setNote("");
    const res = await fetch("/api/admin/bench", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "prepare", characters: choices }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { results?: { name: string; ok: boolean }[] } | null;
    const r = d?.results ?? [];
    const failed = r.filter((x) => !x.ok).map((x) => x.name);
    setNote(r.length ? `${r.length - failed.length} of ${r.length} ready${failed.length ? ` (not: ${failed.join(", ")})` : ""}` : "Couldn't prepare them just now.");
    setBusy(false);
  };
  return (
    <span className="lab-prepare">
      <button type="button" className="lab-add" onClick={() => void go()} disabled={busy}>
        <span className="lab-add-icon" aria-hidden="true">
          ◐
        </span>
        {busy ? "Preparing characters..." : "Prepare characters"}
      </button>
      {note && <span className="meta">{note}</span>}
    </span>
  );
}

/** "Generate more cases": the model writes a number of new, varied test
 *  pages, which are saved like the admin's own. */
function GenerateCases({
  choices,
  pages,
  onSaved,
}: {
  choices: CharacterDef[];
  pages: LabPage[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const n = Math.max(1, Math.min(20, Math.round(Number(count) || 0)));
  const go = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/bench", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate",
          count: n,
          characters: choices.map((c) => ({ name: c.name, look: c.look })),
          existing: pages.map((p) => ({
            label: p.label,
            picture: p.page.picture,
          })),
        }),
      });
      const d = (await res.json().catch(() => null)) as {
        cases?: GenCase[];
        error?: string;
      } | null;
      if (!res.ok || !d?.cases?.length)
        throw new Error(d?.error || "Nothing came back.");
      // (saved newest first in the order written: the first case gets the
      // latest time)
      const now = Date.now();
      const batch = now.toString(36);
      await Promise.all(
        d.cases.map((c, i) =>
          api({
            kind: "page",
            page: caseToPage(
              c,
              choices,
              `gen-${batch}${i.toString(36)}`,
              now - i,
            ),
          }),
        ),
      );
      onSaved();
      setOpen(false);
    } catch (e) {
      setNote(
        e instanceof Error
          ? e.message
          : "Couldn't write new test pages just now.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="lab-add" onClick={() => setOpen(true)}>
        <span className="lab-add-icon" aria-hidden="true">
          ✦
        </span>
        Generate more cases
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <div
            className="modal-panel draft-prompt lab-gen-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lab-gen-title"
          >
            <div className="modal-head">
              <h3 id="lab-gen-title">Generate more cases</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOpen(false)}
                disabled={busy}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="meta">
              New test pages written by Claude, as different as possible from
              each other and from the ones here: places, light and seasons,
              camera, how many characters, what they do and feel, and whether
              there&apos;s a word to tap.
            </p>
            <label className="lab-gen-count">
              How many? (1 to 20)
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && void go()}
                disabled={busy}
                autoFocus
              />
            </label>
            {note && <p className="lab-error">{note}</p>}
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void go()}
              disabled={busy}
            >
              {busy
                ? `Writing ${n} test ${n === 1 ? "page" : "pages"}...`
                : `Generate ${n} ${n === 1 ? "case" : "cases"}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** A test page of the admin's own. */
function NewPage({
  choices,
  onSaved,
}: {
  choices: CharacterDef[];
  onSaved: () => void;
}) {
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
  const toggle = (key: string) =>
    setPicked((p) =>
      p.includes(key)
        ? p.filter((k) => k !== key)
        : p.length < 4
          ? [...p, key]
          : p,
    );
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
    const targetId = tgt
      ? (cast.find((c) => c.name.toLowerCase() === tgt.toLowerCase())?.id ??
        tgt)
      : ids[0];
    const page: LabPage = {
      key: `own-${Date.now().toString(36)}`,
      createdAt: Date.now(),
      label: label.trim() || text.trim().slice(0, 50),
      cast,
      page: {
        text: text.trim(),
        picture: picture.trim(),
        characters: ids,
        action:
          word.trim() && targetId
            ? {
                word: word.trim(),
                target: targetId,
                sound: "pop",
                motion: "bounce",
              }
            : null,
      },
      place: placeId.trim()
        ? { id: placeId.trim(), about: placeAbout.trim() || undefined, light }
        : null,
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
    <section className={open ? "panel lab-new" : "lab-new closed"}>
      <button
        type="button"
        className={`lab-add${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="lab-add-icon" aria-hidden="true">
          +
        </span>
        {open ? "Close" : "New test page"}
      </button>
      {open && (
        <div className="lab-form">
          <label>
            Name (for you)
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Bedtime in the burrow"
            />
          </label>
          <label>
            The page&apos;s words
            <textarea
              className="input"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pip yawned and snuggled under the blanket."
            />
          </label>
          <label>
            The picture to paint
            <textarea
              className="input"
              rows={3}
              value={picture}
              onChange={(e) => setPicture(e.target.value)}
              placeholder="A mid shot inside a cosy burrow at night: Pip in a little bed, yawning, a lamp glowing..."
            />
          </label>
          <div>
            <p className="meta">
              Characters (the first you pick is the hero; up to 4)
            </p>
            <div className="lab-picks">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`lab-chip${picked.includes(c.id) ? " on" : ""}`}
                  onClick={() => toggle(c.id)}
                >
                  {picked.includes(c.id) ? `${picked.indexOf(c.id) + 1}. ` : ""}
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="lab-form-row">
            <label>
              Tap word
              <input
                className="input"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="yawned"
              />
            </label>
            <label>
              Tap target (a name, or a thing)
              <input
                className="input"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="the hero, or e.g. lamp"
              />
            </label>
          </div>
          <div className="lab-form-row">
            <label>
              Place (same name = same place)
              <input
                className="input"
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                placeholder="burrow"
              />
            </label>
            <label>
              Light
              <select
                className="input"
                value={light}
                onChange={(e) => setLight(e.target.value)}
              >
                {["day", "golden", "dusk", "night", "rain"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Camera
              <select
                className="input"
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
              >
                {["close", "mid", "wide"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            The place, as it always is (its landmarks and which side each is on)
            <textarea
              className="input"
              rows={2}
              value={placeAbout}
              onChange={(e) => setPlaceAbout(e.target.value)}
              placeholder="A round burrow room: a little bed on the left, a round window on the right, a rag rug in the middle."
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saving || !text.trim() || !picture.trim()}
          >
            {saving ? "Saving..." : "Add this page"}
          </button>
        </div>
      )}
    </section>
  );
}
