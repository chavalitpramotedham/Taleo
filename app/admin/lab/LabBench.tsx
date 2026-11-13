"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { estimateFor } from "@/lib/bench-estimates";
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
    name: "v0",
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
        "the first way 3 (Sonnet at medium, thinking first), which cost more than v0",
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
  /** the connection dropped: the server paints on and saves it, and the
   *  bench is waiting for that */
  reconnecting?: boolean;
  /** it fell back to the ordinary way part-way (see paintPage) */
  fellBack?: boolean;
}
/** The painting's stream stopped without its ending (the connection
 *  dropped); `gen` says the server had taken the request up. */
class ConnectionLost extends Error {
  constructor(public gen?: string) {
    super("connection lost");
  }
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
      /** fell back to the ordinary way part-way (why): not this way's work */
      fellBack?: string;
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
  /** paintings that fell back to the ordinary way (left out of the rest) */
  fellBack?: number;
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
    setArchived(new Set((d.archived as string[] | undefined) ?? []));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // (newest first: the pages added or generated, by when, then the
  // bench's own fixed ones)
  const pages = useMemo(() => {
    const at = (p: LabPage) =>
      p.createdAt ?? (parseInt(p.key.split("-")[1] ?? "", 36) || 0);
    // (every page by when it was added - the bench's earliest fixed ones,
    // which have no date, keep their order at the end)
    return [...own, ...fixed].map((p, i) => ({ p, i })).sort((a, b) => at(b.p) - at(a.p) || a.i - b.i).map((x) => x.p);
  }, [own, fixed]);
  // What's prepared ahead (characters' parts, way 5's poses): the Prepare
  // buttons show a tick once all of it is. (Asked again as pages change,
  // and after each Prepare.)
  const [prepared, setPrepared] = useState<{ parts: Ready; poses: Ready; places?: Ready } | null>(null);
  // (every test page's place, once each)
  const places = useMemo(() => [...new Map(pages.filter((p) => p.place?.id).map((p) => [`${p.place!.id}|${p.place!.light ?? ""}`, p.place!])).values()], [pages]);
  const castKey = useMemo(() => [...new Set(pages.flatMap((p) => p.cast.map((c) => c.name)))].sort().join("|"), [pages]);
  const checkPrepared = useCallback(async () => {
    const cast = [...new Map(pages.flatMap((p) => p.cast).filter((c) => c.preset || c.svg).map((c) => [c.name, c])).values()];
    const d = await fetch("/api/admin/bench", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "prepared", characters: choices, cast, places, world }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (d?.parts && d?.poses) setPrepared(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castKey, choices, places.length]);
  useEffect(() => {
    void checkPrepared();
  }, [checkPrepared]);
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

  /** After a dropped connection: reads the run until the server has saved
   *  this way's result, then shows it as saved. False if it never comes. */
  const waitForSaved = async (runId: string, way: string, forMs: number): Promise<boolean> => {
    setCell(runId, way, { state: "painting", reconnecting: true });
    const until = Date.now() + forMs;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 5000));
      const d = await fetch("/api/admin/bench", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const run = (d?.runs as Run[] | undefined)?.find((r) => r.id === runId);
      if (!run?.ways[way]) continue;
      // (the live cell gives way to the saved result and its picture)
      setCells((all) => {
        const mine = { ...all[runId] };
        delete mine[way];
        return { ...all, [runId]: mine };
      });
      await load();
      return true;
    }
    return false;
  };

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
      let serverFailed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        first ||= performance.now() - began;
        if (text.includes("<!--taleo:error-->")) serverFailed = true;
        text = text.replace("<!--taleo:error-->", "");
        const again = text.lastIndexOf(RESTART);
        if (again >= 0) {
          text = text.slice(again + RESTART.length);
          setCell(runId, way, { fellBack: true });
        }
        setCell(runId, way, { svg: text.replace(DONE, ""), firstMs: first });
      }
      const ok = text.includes(DONE);
      // (the stream stopped with neither an ending nor the server's own
      // failure: the connection dropped - the server paints on)
      if (!ok && !serverFailed) throw new ConnectionLost(gen);
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
    } catch (e) {
      // The connection dropped (a weak signal, the phone sleeping): the
      // painting goes on on the server, which saves it to the run - so
      // wait for that, rather than calling it failed. (If the request
      // never got there, there's nothing to wait for long.)
      const lost = e instanceof ConnectionLost || e instanceof TypeError;
      const asked = e instanceof ConnectionLost && Boolean(e.gen);
      if (lost && (await waitForSaved(runId, way, asked ? 6 * 60_000 : 45_000))) return;
      setCell(runId, way, {
        state: "failed",
        reconnecting: false,
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
  // test pages put away (hidden unless "All")
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const toggleArchive = async (key: string) => {
    const now = !archived.has(key);
    setArchived((a) => {
      const n = new Set(a);
      if (now) n.add(key);
      else n.delete(key);
      return n;
    });
    await api({ kind: "archive", key, archived: now });
  };
  const openPast = (key: string) => {
    setPast(key);
    for (const r of runs.filter((x) => x.page === key)) void opened(r);
  };
  // (all test pages, or just those not yet painted all four ways and ranked)
  // which test pages show: the current ones (not archived), only those
  // still to finish, or all - archived too
  const [listing, setListing] = useState<"current" | "open" | "all">("current");
  const onlyOpen = listing === "open";
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
  const [rankBy, setRankBy] = useState<"code" | "score" | "avg">("code");
  // (just the four in use now, unless all variants are asked for)
  const [showAll, setShowAll] = useState(false);
  const numbered = [...board]
    .sort(
      (a, b) =>
        (a.firstAt ?? Infinity) - (b.firstAt ?? Infinity) ||
        SLOT_ORDER.indexOf(a.way) - SLOT_ORDER.indexOf(b.way),
    )
    .map((b, i) => ({ b, n: b.firstAt === null ? null : i + 1 }));
  // (by average score: points per ranking it took part in - fair to a way
  // ranked fewer times than today's, which is in every ranking; unranked
  // ones last)
  const avgOf = (b: Board) => (b.votedRuns ? b.score / b.votedRuns : -1);
  const ranked =
    rankBy === "code"
      ? numbered
      : rankBy === "avg"
        ? [...numbered].sort((x, y) => avgOf(y.b) - avgOf(x.b) || y.b.votedRuns - x.b.votedRuns || (x.n ?? 1e9) - (y.n ?? 1e9))
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
    const est = b && b.way !== "1" ? estimateFor(b.variant) : undefined;
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
      `${x.what} ${x.got < 0 ? `${Math.round(-x.got)}% ${x.more}` : `${Math.round(x.got)}% ${x.less}`} than v0, expected ${x.want}% ${x.less}`;
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
          ? ` · ${cost <= today ? "-" : "+"}${Math.abs(Math.round((1 - cost / today) * 100))}% vs v0`
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

      <BenchUsage runs={runs} />
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
            <button
              type="button"
              className={`lab-chip${rankBy === "avg" ? " on" : ""}`}
              onClick={() => setRankBy("avg")}
            >
              Avg score
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
                <th>vs v0</th>
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
                        {b.way !== "1" && estimateFor(b.variant)
                          ? `-${estimateFor(b.variant)!.costPc}%`
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
                      <td className="lab-wide" title={b.fellBack ? `${b.fellBack} more fell back to the ordinary way, and aren't counted` : undefined}>
                        {b.painted}
                        {b.fellBack ? <small className="lab-fell"> +{b.fellBack} fell back</small> : null}
                      </td>
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
            {specWay.id !== "1" &&
              (() => {
                const e = estimateFor(variantOf(specWay.id as BenchSlot));
                return e ? (
                  <p className="meta lab-spec-est">
                    <b>Expected:</b> {usd(e.usd)} and {secs(e.ms)} a page (
                    {e.costPc}% cheaper, {e.timePc}% faster than v0). {e.why}
                  </p>
                ) : (
                  <p className="meta lab-spec-est">
                    <b>Expected:</b> no estimate written for this variant
                    yet.
                  </p>
                );
              })()}
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
            <NewPage choices={choices} onSaved={load} />
            <GenerateCases choices={choices} pages={pages} onSaved={load} />
            <span className="lab-bar-dot" aria-hidden="true">
              ·
            </span>
            <PrepareCharacters choices={choices} ready={prepared?.parts} onDone={checkPrepared} />
            <PreparePoses pages={pages} ready={prepared?.poses} onDone={checkPrepared} />
            <PreparePlaces places={places} world={world} ready={prepared?.places} onDone={checkPrepared} />
            <span
              className="lab-pages-filter"
              role="group"
              aria-label="Which test pages"
            >
              <button type="button" className={`lab-chip${listing === "current" ? " on" : ""}`} onClick={() => setListing("current")}>
                Current ({pages.filter((q) => !archived.has(q.key)).length})
              </button>
              <button type="button" className={`lab-chip${listing === "open" ? " on" : ""}`} onClick={() => setListing("open")}>
                Uncompleted ({pages.filter((q) => !archived.has(q.key) && stageOf(runs.find((r) => r.id === runFor(q.key)), false) !== "ranked").length})
              </button>
              <button type="button" className={`lab-chip${listing === "all" ? " on" : ""}`} onClick={() => setListing("all")}>
                All ({pages.length})
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
            if (listing !== "all" && archived.has(p.key)) return null;
            const isArchived = archived.has(p.key);
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
                    {isArchived ? " · archived" : ""}
                  </span>
                  <button
                    type="button"
                    className={`lab-archive${isArchived ? " on" : ""}`}
                    aria-label={isArchived ? "Bring this test page back" : "Archive this test page"}
                    title={isArchived ? "Unarchive" : "Archive"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void toggleArchive(p.key);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="5" rx="1.5" />
                      <path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" />
                      {isArchived ? <path d="M12 17v-5m-2.5 2.5L12 12l2.5 2.5" /> : <path d="M10 13h4" />}
                    </svg>
                  </button>
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
                          <b title={`${nOf(w.id)}. ${w.name}`}>
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
                        {(c?.fellBack || saved?.fellBack) && (
                          <p className="meta lab-fell-note" title={saved?.fellBack}>
                            Fell back to v0&apos;s way part-way
                            {saved?.fellBack ? `: ${saved.fellBack.slice(0, 90)}` : ""}. Not
                            counted for this way.
                          </p>
                        )}
                        {c?.reconnecting && c.state === "painting" && (
                          <p className="meta lab-reconnect">
                            Connection dropped: still painting, waiting for
                            it...
                          </p>
                        )}
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

/** The bench's own use, over the last day and the last 7: paintings made
 *  (every way of every page painted, failed ones too), how many painting
 *  versions they used, and what they cost in all (set-up included). From
 *  the runs loaded (the latest 400). */
function BenchUsage({ runs }: { runs: Run[] }) {
  const now = Date.now();
  const over = (ms: number) => {
    const results = runs.filter((r) => now - r.at <= ms).flatMap((r) => Object.entries(r.ways).map(([k, x]) => ({ k, x })));
    return {
      paints: results.length,
      versions: new Set(results.map(({ k, x }) => x.variant ?? legacyVariant(k.split("@")[0]))).size,
      usd: results.reduce((t, { x }) => t + (x.usd || 0) + (x.setupUsd || 0), 0),
    };
  };
  const rows: [string, ReturnType<typeof over>][] = [
    ["Last 24 hours", over(86_400_000)],
    ["Last 7 days", over(7 * 86_400_000)],
  ];
  return (
    <div className="lab-usage" aria-label="Bench use">
      {rows.map(([label, u]) => (
        <div key={label} className="lab-usage-row">
          <span className="lab-usage-label">{label}</span>
          <span>
            <b>{u.paints.toLocaleString()}</b> paintings
          </span>
          <span>
            <b>{u.versions}</b> {u.versions === 1 ? "version" : "versions"}
          </span>
          <span>
            <b>{usd(u.usd)}</b> spent
          </span>
        </div>
      ))}
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
          !x!.fellBack &&
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
  const est = way === "1" ? null : estimateFor(variantOf(way as BenchSlot));
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
            {costSave ? `${costSave} than v0` : "no baseline yet"}
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
            {timeSave ? `${timeSave} than v0` : "no baseline yet"}
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
          <span>v0, for comparison</span>
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

/** How much of something is prepared: so many ready of so many. */
type Ready = { ready: number; of: number; missing?: string[] };

/** A Prepare request, given up on after 4 minutes (the server stops at 5):
 *  null if it failed or took too long. */
async function prepareCall(body: object): Promise<Record<string, unknown> | null> {
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), 240_000);
  try {
    const r = await fetch("/api/admin/bench", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: stop.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Runs jobs a few at a time, counting them off as they finish. */
async function inTurn<J>(jobs: J[], at: number, run: (j: J) => Promise<boolean>, tick: (n: number, failed: number) => void) {
  const queue = [...jobs];
  let n = 0;
  let failed = 0;
  const next = async (): Promise<void> => {
    const job = queue.shift();
    if (job === undefined) return;
    const ok = await run(job).catch(() => false);
    n++;
    if (!ok) failed++;
    tick(n, failed);
    return next();
  };
  await Promise.all(Array.from({ length: at }, next));
}

/** A Prepare button's icon: orange while there's something to prepare (or
 *  it isn't known yet), a green tick once everything is. */
function PrepIcon({ ready, busy, icon }: { ready?: Ready; busy: boolean; icon: string }) {
  const done = !busy && ready && ready.of > 0 && ready.ready >= ready.of;
  return (
    <span
      className={`lab-add-icon${done ? " done" : ""}`}
      aria-hidden="true"
      title={ready ? `${ready.ready} of ${ready.of} ready` : undefined}
    >
      {done ? "✓" : icon}
    </span>
  );
}

/** How many are ready, as a small count inside a Prepare button. */
function PrepCount({ ready }: { ready?: Ready }) {
  if (!ready || !ready.of) return null;
  return (
    <span className={`lab-count${ready.ready >= ready.of ? " done" : ""}`}>
      {ready.ready}/{ready.of}
    </span>
  );
}

/** "Prepare poses" (way 5): every test page's characters painted in each
 *  pose, ahead and kept - one pose per request, a few at once, with the
 *  count shown as they're done. Poses already made are found at once. */
function PreparePoses({ pages, ready, onDone }: { pages: LabPage[]; ready?: Ready; onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ n: number; of: number; failed: number } | null>(null);
  const go = async () => {
    setBusy(true);
    // (newcomers - characters with no portrait - have no poses to make:
    // they're painted on the page itself)
    const chars = [...new Map(pages.flatMap((p) => p.cast).filter((c) => c.preset || c.svg).map((c) => [c.name, c])).values()];
    const jobs = chars.flatMap((c) => SPRITE_POSE_IDS.map((pose) => ({ c: { ...c, id: "hero" }, pose })));
    setDone({ n: 0, of: jobs.length, failed: 0 });
    // (three at a time: each asks for a large reply, and more at once used
    // up the account's per-minute allowance - pages painted meanwhile were
    // turned away)
    await inTurn(
      jobs,
      3,
      async (job) => Boolean((await prepareCall({ kind: "prepare-pose", character: job.c, pose: job.pose }))?.ok),
      (n, failed) => setDone({ n, of: jobs.length, failed }),
    );
    await onDone();
    setBusy(false);
  };
  return (
    <span className="lab-prepare">
      <button
        type="button"
        className="lab-add"
        onClick={() => void go()}
        disabled={busy}
        title={done?.failed ? `${done.failed} couldn't be painted last time` : undefined}
      >
        <PrepIcon ready={ready} busy={busy} icon="✎" />
        {busy ? "Preparing poses" : "Prepare poses"}
        <PrepCount ready={busy && done ? { ready: done.n, of: done.of } : ready} />
      </button>
    </span>
  );
}

/** "Prepare places": each test page's place painted ahead as a standing
 *  backdrop, kept and shared by every way and page set there - so the
 *  first page at a place doesn't wait ~25 s for it. Each page still has
 *  its own sky, foreground, framing and moment's details over it. */
function PreparePlaces({ places, world, ready, onDone }: { places: { id: string; about?: string; light?: string }[]; world: string; ready?: Ready; onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ n: number; of: number } | null>(null);
  const go = async () => {
    setBusy(true);
    setDone({ n: 0, of: places.length });
    await inTurn(
      places,
      3,
      async (place) => Boolean((await prepareCall({ kind: "prepare-place", place, world }))?.ok),
      (n) => setDone({ n, of: places.length }),
    );
    await onDone();
    setBusy(false);
  };
  return (
    <span className="lab-prepare">
      <button type="button" className="lab-add" onClick={() => void go()} disabled={busy}>
        <PrepIcon ready={ready} busy={busy} icon="⌂" />
        {busy ? "Preparing places" : "Prepare places"}
        <PrepCount ready={busy && done ? { ready: done.n, of: done.of } : ready} />
      </button>
    </span>
  );
}

/** "Prepare characters": every character's parts made ahead and kept,
 *  once for all ways and pages - so no page waits on them, and every way
 *  paints from the same. (A family's character gets its parts as it's
 *  made, once painting from parts is switched on for everyone.) */
function PrepareCharacters({ choices, ready, onDone }: { choices: CharacterDef[]; ready?: Ready; onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ n: number; of: number; failed: string[] } | null>(null);
  const go = async () => {
    setBusy(true);
    // (one character a request, a few at once: one slow character holds up
    // nothing else, and the count moves as each is done)
    const failed: string[] = [];
    setDone({ n: 0, of: choices.length, failed });
    await inTurn(
      choices,
      4,
      async (c) => {
        const d = (await prepareCall({ kind: "prepare", characters: [c] })) as { results?: { ok: boolean }[] } | null;
        const ok = Boolean(d?.results?.[0]?.ok);
        if (!ok) failed.push(c.name);
        return ok;
      },
      (n) => setDone({ n, of: choices.length, failed: [...failed] }),
    );
    await onDone();
    setBusy(false);
  };
  const missing = ready?.missing?.length ? `Not ready: ${ready.missing.join(", ")}` : undefined;
  return (
    <span className="lab-prepare">
      <button type="button" className="lab-add" onClick={() => void go()} disabled={busy} title={busy ? undefined : missing}>
        <PrepIcon ready={ready} busy={busy} icon="◐" />
        <span>
          {busy ? "Preparing" : "Prepare"} <span className="lab-long">characters</span>
          <span className="lab-short">chars</span>
        </span>
        <PrepCount ready={busy && done ? { ready: done.n, of: done.of } : ready} />
      </button>
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
        className={`lab-add${open ? " open" : " lab-add-bare"}`}
        onClick={() => setOpen((o) => !o)}
        title={open ? undefined : "New test page"}
        aria-expanded={open}
      >
        <span className="lab-add-icon" aria-hidden="true">
          +
        </span>
        {open ? "Close" : <span className="sr-only">New test page</span>}
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
