"use client";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { HOME_LAYERS, type HomeLayer } from "@/lib/art/homeLayers";
import { MoonIcon } from "./NightLamp";

const TITLE =
  "A little fox leaps across a stream from a stepping stone, into the open arms of Papa fox waiting on the far bank, while a frog cheers from a lily pad";

/** The story, in the two lines written under the picture: before the
 *  choice, and after it. */
const LINE_1 = "The stream looked so wide. “I can’t,” said Kit.";
const LINE_2 = "“You can do it,” said Papa. Kit tried once more, and flew.";
/** The choice a parent and child would be given at this point. */
const QUESTION = "What should Kit do?";
const OPTIONS = ["Turn back", "Try once more"] as const;
const PICKED = 1;
const LESSON = "Courage";

/** When each part of the sample scene starts painting in, and how long it
 *  takes - by the part's name in the scene, in the scene's own order: the
 *  land and the stream, Papa waiting, the frog, little Kit not daring...
 *  then, once the choice is made, Kit in the air. Each part begins before
 *  the last has finished, so the picture builds in one calm, overlapping
 *  flow. */
const SCHEDULE: Record<string, { start: number; dur: number; stage: string | null }> = {
  "sky-land": { start: 0, dur: 2400, stage: "Washing in the sky…" },
  "stream-trees": { start: 800, dur: 2400, stage: "Washing in the stream…" },
  props: { start: 2400, dur: 1800, stage: "An old maple, stepping stones…" },
  papa: { start: 3600, dur: 2000, stage: "Painting Papa fox…" },
  "papa-ink": { start: 4800, dur: 1800, stage: "Painting Papa fox…" },
  "papa-detail": { start: 5900, dur: 700, stage: "Painting Papa fox…" },
  frog: { start: 6000, dur: 1400, stage: "A frog on a lily pad…" },
  "frog-detail": { start: 6900, dur: 500, stage: "A frog on a lily pad…" },
  "scenery-ink": { start: 6600, dur: 2200, stage: "A frog on a lily pad…" },
  "kit-waits": { start: 7600, dur: 1500, stage: "Painting little Kit…" },
  "kit-waits-ink": { start: 8400, dur: 1400, stage: "Painting little Kit…" },
  "kit-waits-detail": { start: 9100, dur: 500, stage: "Painting little Kit…" },
  // (the choice is asked and made here: see CHOICE_AT, PICK_AT. From then
  // on nothing is "painted": the painter's work is done, and the story
  // takes over - Kit simply jumps (see JUMP_AT), and the last leaves and
  // touches arrive quietly, with no brush and no label.)
  "kit-leaps": { start: 14500, dur: 140, stage: null },
  "kit-leaps-ink": { start: 14500, dur: 140, stage: null },
  "kit-leaps-detail": { start: 15300, dur: 400, stage: null },
  extras: { start: 15500, dur: 1200, stage: null },
  "finish-ink": { start: 15700, dur: 1200, stage: null },
};
/** Kit in the air: these parts aren't painted - they jump, as one. */
const LEAPS = (name: string) => name.startsWith("kit-leaps");
/** The parts of the first beat that are taken away for the second: Kit on
 *  the bank, once Kit is in the air. */
const WAITS = (name: string) => name.startsWith("kit-waits");
const STAGES = Object.values(SCHEDULE).sort((a, b) => b.start - a.start);

const PAINT_MS = 16400; // all parts in
/** Layers fetched straight away (the rest wait until painting begins). */
const EAGER = 2;
const HOLD_MS = 4600; // admire the finished picture, and read its lesson
const FADE_MS = 1200; // soft fade before it starts again
const CHAR_MS = 52;
const LINE_1_AT = 7400; // as little Kit is painted
const CHOICE_AT = 10000; // the two choices are offered...
const PICK_AT = 11600; // ...and one is tapped
const LINE_2_AT = 12500;
const JUMP_AT = 14500; // Kit jumps (as the line reaches "and flew")
const JUMP_MS = 900;
const WAIT_OUT_AT = JUMP_AT; // Kit leaves the bank
/** The line's key word: underlined like a story's tappable word, and - as
 *  Kit lands - popped up over the picture, the way a word does in a story
 *  when it's tapped. */
const WORD = "flew";
const WORD_FROM = LINE_2.lastIndexOf(WORD);
const POP_AT = Math.max(JUMP_AT + JUMP_MS - 200, LINE_2_AT + (WORD_FROM + WORD.length) * CHAR_MS);
const POP_MS = 1900;
const LESSON_AT = 16700;

/**
 * Begins the painting as soon as its first two washes have arrived - as
 * the page itself arrives, without waiting for the app's scripts (on a
 * slow phone those take seconds more, and the picture is the largest thing
 * on the page). It only sets the painting going - the CSS does the rest -
 * and notes when; the app, once there, falls in step with it (the story
 * line, the choice, the labels). Not with reduced motion, and not when the
 * picture is put on the page by the app itself (then the app starts it).
 */
const EARLY_START = `(function(){try{var s=document.currentScript,f=s&&s.previousElementSibling,r=f&&f.querySelector(".hero-paint-canvas");if(!r||matchMedia("(prefers-reduced-motion: reduce)").matches)return;var im=r.querySelectorAll("img"),n=0,done=false;function go(){if(done)return;done=true;for(var i=0;i<im.length;i++){var d=im[i].getAttribute("data-src");if(d&&!im[i].getAttribute("src"))im[i].src=d}r.classList.remove("hero-paint-pending");r.classList.add("playing");f.classList.add("hero-early");r.dataset.started=String(performance.now())}function one(){if(++n>=Math.min(${EAGER},im.length))go()}for(var i=0;i<${EAGER}&&i<im.length;i++){(function(g){if(g.decode)g.decode().then(one,one);else if(g.complete)one();else{g.addEventListener("load",one);g.addEventListener("error",one)}})(im[i])}setTimeout(go,4000)}catch(e){}})()`;

/** What the strip under the story line shows. */
type Turn = "none" | "ask" | "picked" | "lesson";

/**
 * The homepage picture, painted gently before your eyes - and with it, in
 * twenty seconds, what a Taleo story is: a line of the story is written, a
 * choice is offered and made ("Try once more"), the picture finishes with
 * what was chosen, and the story's lesson is named. Then it rests, fades,
 * and begins again.
 *
 * Whole parts of the scene fade in together (washes, then each character
 * with its pen lines drawing on), overlapping so it builds in one calm
 * flow, while a brush drifts slowly across the page.
 *
 * Built to cost almost nothing while it plays:
 *  - the painted parts are still images made beforehand (see
 *    scripts/render-home-layers.cjs), each only as big as what it paints,
 *    that do nothing but fade - the browser's compositor does it, and the
 *    watercolour filters never run on the page;
 *  - the painting, the brush, the choice and the lesson are CSS animations
 *    of opacity and transform alone (scheduled per part with custom
 *    properties); the strip under the picture keeps a fixed height, so
 *    nothing on the page ever moves;
 *  - a light clock (a timer, twenty ticks a second - not one per frame)
 *    keeps the story line and the labels in step, touching the page only
 *    when something changes; everything pauses together
 *    while off-screen or in a hidden tab.
 * Reduced motion shows the finished picture, its line and its lesson.
 */
export function HeroPainting() {
  // The pre-painted layers are asked for from the very first byte of the
  // page (the big base wash first, at high priority) rather than when the
  // picture is reached - the painting waits on them, and so does the
  // page's largest picture.
  // Only the first two (the washes painted in the first second) are asked
  // for up front; the rest are requested once painting begins, so on a slow
  // connection they don't hold up the first ones - they arrive well before
  // their turn, a few seconds into the painting.
  // (the torn-paper edge they're shown through is asked for by every
  // page: see the root layout)
  HOME_LAYERS.slice(0, EAGER).forEach((l, i) => {
    if ("src" in l) preload(l.src, { as: "image", fetchPriority: i === 0 ? "high" : "auto" });
  });
  const [rest, setRest] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  // (before the page is live, and with reduced motion: the story as it
  // ends - the second line whole, and the lesson)
  const [live, setLive] = useState(false);
  const [line, setLine] = useState<1 | 2>(2);
  const [typed, setTyped] = useState(LINE_2.length);
  const [turn, setTurn] = useState<Turn>("lesson");
  const [stage, setStage] = useState<string | null>(null);
  const [pop, setPop] = useState(false);
  // (the label keeps its words while it fades away, rather than emptying)
  const said = useRef("");
  if (stage) said.current = stage;

  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.remove("hero-paint-pending");
      setRest(true);
      return;
    }
    root.style.setProperty("--paint-ms", `${PAINT_MS}ms`);
    // Start (or restart) the painting.
    const play = () => {
      root.classList.remove("playing");
      void root.offsetWidth; // restart the CSS animations from the top
      root.classList.add("playing");
    };

    // Don't start straight away: let the page arrive and settle first (fonts,
    // the rest of the page, the theme), then begin painting on blank paper,
    // so entering the page never competes with the painting's first frames.
    let stop: (() => void) | null = null;
    let cancelled = false;
    const start = async () => {
      // Already begun, before the app itself had arrived (see EARLY_START):
      // nothing to start - only fall in step with it.
      const early = Number(root.dataset.started) || 0;
      if (early) {
        setRest(true);
        stop = run(early);
        return;
      }
      // Start once the base wash (painted first) is ready - the later
      // layers are already on their way and arrive long before their turn
      // in the painting, so the picture begins seconds sooner on a slow
      // connection without anything popping in.
      const imgs = Array.from(root.querySelectorAll("img"));
      await Promise.race([
        Promise.all(imgs.slice(0, EAGER).map((img) => img.decode().catch(() => {}))),
        new Promise((r) => window.setTimeout(r, 4000)),
      ]);
      if (cancelled) return;
      root.classList.remove("hero-paint-pending");
      setRest(true);
      play();
      stop = run();
    };
    // Blank paper and an empty line, pen poised, while it waits.
    setLine(1);
    setTyped(0);
    setTurn("none");
    setLive(true);
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    let wait = 0;
    // (a short wait at most: on a slow phone the page is never "idle" for
    // long while it arrives, and the picture is the largest thing on it)
    // (already painting - see EARLY_START: fall in step at once)
    // (a moment later, not on the spot: what it runs is set up just below)
    const idle = Number(root.dataset.started) ? (void Promise.resolve().then(start), 0) : (ric(() => (wait = window.setTimeout(() => void start(), 0)), { timeout: 350 }) as number);

    const run = (startedAt?: number) => {
      // A light clock that only advances while the picture is on screen,
      // keeping the story line, the choice and the labels in step with the
      // (paused-alongside) CSS. Time is measured on the real clock minus
      // paused time (not by adding up frames), so they stay in step with
      // the CSS animations even when frames are slow or dropped.
      let visible = true;
      let pageVisible = !document.hidden;
      let cycleStart = startedAt ?? performance.now();
      let pausedAt: number | null = document.hidden ? performance.now() : null;
      let pausedTotal = 0;
      const syncPause = () => {
        const paused = !(visible && pageVisible);
        root.classList.toggle("paused", paused);
        const now = performance.now();
        if (paused && pausedAt === null) pausedAt = now;
        if (!paused && pausedAt !== null) {
          pausedTotal += now - pausedAt;
          pausedAt = null;
        }
      };
      const io = new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
          syncPause();
        },
        { threshold: 0.1 },
      );
      io.observe(root);
      const onVis = () => {
        pageVisible = !document.hidden;
        syncPause();
      };
      document.addEventListener("visibilitychange", onVis);

      // The clock ticks twenty times a second, on a timer: all it does is
      // put the next letter on the line and change a label now and then,
      // and a tick per screen frame (sixty or more a second) made the
      // browser prepare a frame each time, even while the finished
      // picture just rests. While paused it barely ticks at all.
      let timer = 0;
      const TICK_MS = 50;
      // (what's on the page now: the page is only touched when one changes)
      let lastStage: string | null = null;
      let lastLine = 0;
      let lastTyped = -1;
      let lastTurn: Turn | null = null;
      let lastPop = false;
      const frame = () => {
        // (nothing to keep in step while it's paused: no work at all)
        if (pausedAt !== null) {
          timer = window.setTimeout(frame, 300);
          return;
        }
        const now = performance.now();
        const elapsed = now - cycleStart - pausedTotal;

        // (once the choice is made there's nothing more to say about the
        // painting: the movement and the word have the stage)
        const st = elapsed < CHOICE_AT ? (STAGES.find((s) => s.start <= elapsed)?.stage ?? null) : null;
        // (while the choice is being made the painter waits too: the label
        // asks the question instead - on a narrow screen, where there's no
        // room for it beside the two answers)
        const label = elapsed >= CHOICE_AT && elapsed < LINE_2_AT ? QUESTION : elapsed >= CHOICE_AT - 500 && elapsed < CHOICE_AT ? null : st;
        if (label !== lastStage) setStage((lastStage = label));

        const ln = elapsed < LINE_2_AT ? 1 : 2;
        const text = ln === 1 ? LINE_1 : LINE_2;
        const t = Math.max(0, Math.min(text.length, Math.floor((elapsed - (ln === 1 ? LINE_1_AT : LINE_2_AT)) / CHAR_MS)));
        if (ln !== lastLine) setLine((lastLine = ln) as 1 | 2);
        if (t !== lastTyped) setTyped((lastTyped = t));

        const tn: Turn = elapsed < CHOICE_AT ? "none" : elapsed < PICK_AT ? "ask" : elapsed < LINE_2_AT + 900 ? "picked" : elapsed < LESSON_AT ? "none" : "lesson";
        if (tn !== lastTurn) setTurn((lastTurn = tn));
        const pp = elapsed >= POP_AT && elapsed < POP_AT + POP_MS;
        if (pp !== lastPop) setPop((lastPop = pp));

        if (elapsed >= PAINT_MS + HOLD_MS && !root.classList.contains("hero-paint-fade")) root.classList.add("hero-paint-fade");
        if (elapsed >= PAINT_MS + HOLD_MS + FADE_MS) {
          cycleStart = now;
          pausedTotal = 0;
          play();
          root.classList.remove("hero-paint-fade");
        }
        timer = window.setTimeout(frame, TICK_MS);
      };
      timer = window.setTimeout(frame, TICK_MS);
      return () => {
        window.clearTimeout(timer);
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
      };
    };

    return () => {
      cancelled = true;
      (window.cancelIdleCallback ?? clearTimeout)(idle);
      clearTimeout(wait);
      stop?.();
    };
  }, []);

  // One part of the scene: a pre-painted image set where it paints on the
  // sheet (only ever faded), or pen lines that draw on as live SVG - so
  // playing the painting never re-runs the watercolour filters.
  const part = (l: HomeLayer, i: number) => {
    const slot = SCHEDULE[l.name] ?? { start: Math.min(PAINT_MS - 1500, 1000 * i), dur: 1500 };
    const timing = { "--d": `${slot.start}ms`, "--dur": `${slot.dur}ms` } as React.CSSProperties;
    if (l.kind === "ink") {
      return <svg key={l.name} viewBox="0 0 400 300" className="hero-layer hp-g hp-g-ink" style={timing} aria-hidden dangerouslySetInnerHTML={{ __html: l.svg }} />;
    }
    const [left, top, width, height] = l.box;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={l.name}
        src={i < EAGER || rest ? l.src : undefined}
        // (for the early start, which fills these in itself)
        data-src={l.src}
        suppressHydrationWarning
        alt=""
        className={`hero-layer hp-cut hp-g hp-g-${l.kind}`}
        style={{ ...timing, left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
        width={l.px[0]}
        height={l.px[1]}
        decoding="async"
      />
    );
  };
  const firstWait = HOME_LAYERS.findIndex((l) => WAITS(l.name));
  const firstLeap = HOME_LAYERS.findIndex((l) => LEAPS(l.name));
  const text = line === 1 ? LINE_1 : LINE_2;
  // (the line as written so far, its key word picked out once reached)
  const shown = live ? text.slice(0, typed) : text;
  const written =
    line === 2 && shown.length > WORD_FROM ? (
      <>
        {shown.slice(0, WORD_FROM)}
        <span className={`hero-word ${pop ? "lit" : ""}`}>{shown.slice(WORD_FROM, WORD_FROM + WORD.length)}</span>
        {shown.slice(WORD_FROM + WORD.length)}
      </>
    ) : (
      shown
    );

  return (
    <>
    {/* (the page's own early script starts the painting before this is
        hydrated - classes, start time, picture sources - on purpose: React
        is told not to mind) */}
    <figure className="hero-art hero-paint" suppressHydrationWarning>
      <div ref={wrap} className="hero-paint-canvas hero-paint-pending" suppressHydrationWarning style={{ "--wait-out": `${WAIT_OUT_AT}ms`, "--jump-at": `${JUMP_AT}ms`, "--jump-ms": `${JUMP_MS}ms`, "--paint-ms": `${PAINT_MS}ms` } as React.CSSProperties}>
        {/* The scene as a stack of layers, one per part, in paint order. */}
        <div className="hero-layers painted-edge" role="img" aria-label={TITLE}>
          <svg viewBox="0 0 400 300" className="hero-layer" aria-hidden>
            <rect className="paint-paper" width="400" height="300" />
          </svg>
          {HOME_LAYERS.map((l, i) =>
            WAITS(l.name) ? (
              // (little Kit on the bank: painted, then taken away as one,
              // when Kit is painted in the air)
              i === firstWait && (
                <div key="kit-waits" className="hero-layer hero-wait">
                  {HOME_LAYERS.map((w, j) => WAITS(w.name) && part(w, j))}
                </div>
              )
            ) : LEAPS(l.name) ? (
              // (Kit in the air: not painted - the whole of Kit jumps
              // from the bank, in one arc)
              i === firstLeap && (
                <div key="kit-leaps" className="hero-layer hero-leap">
                  {HOME_LAYERS.map((w, j) => LEAPS(w.name) && part(w, j))}
                </div>
              )
            ) : (
              part(l, i)
            ),
          )}
          <svg viewBox="0 0 400 300" className="hero-layer" aria-hidden>
            <rect className="paint-dim" width="400" height="300" />
            <rect width="400" height="300" fill="url(#tl-grain)" style={{ mixBlendMode: "multiply" }} />
          </svg>
        </div>
        <p className={`hero-stage ${stage ? "on" : ""} ${(stage ?? said.current) === QUESTION ? "ask" : ""}`} aria-hidden>
          {stage ?? said.current}
        </p>
        {/* the line's key word, popped up over Kit as in a story */}
        <span className={`hero-word-bubble ${pop ? "on" : ""}`} aria-hidden>
          {WORD}
        </span>
        <div className="hero-brush" aria-hidden>
          {/* its shadow on the paper, offset down and to the right, so the
              brush reads as held just above the painting */}
          <span className="hero-brush-shadow">
            <BrushArt />
          </span>
          <BrushArt />
        </div>
      </div>
      <figcaption className={live ? "live" : undefined} aria-label={`${LINE_1} ${QUESTION} ${OPTIONS[PICKED]}. ${LINE_2} Tonight’s lesson: ${LESSON.toLowerCase()}.`}>
        <p className="hero-line" aria-hidden>
          <span>{written}</span>
          <span className={`hero-quill ${live && typed < text.length ? "on" : ""}`} />
        </p>
        {/* Under the line, in one strip of fixed height (nothing on the
            page moves as they come and go): the choice, then the lesson. */}
        <div className="hero-turn" aria-hidden>
          <div className={`hero-choice ${turn === "ask" || turn === "picked" ? "on" : ""} ${turn === "picked" ? "picked" : ""}`}>
            <span className="hero-choice-q">{QUESTION}</span>
            <span className="hero-choice-opts">
              {OPTIONS.map((o, i) => (
                <span key={o} className={`hero-opt ${i === PICKED ? "pick" : ""}`}>
                  {o}
                </span>
              ))}
            </span>
          </div>
          <p className={`hero-lesson ${turn === "lesson" ? "on" : ""}`}>
            <span className="hero-lesson-pill">
              {/* (the bedtime moon, not the brand's leaf) */}
              <MoonIcon on />
              {/* (the words share one baseline, whatever the browser) */}
              <span className="hero-lesson-text">
                <span className="hero-lesson-label">Tonight’s lesson</span>
                <span className="hero-lesson-dash">–</span>
                <b>{LESSON}</b>
              </span>
            </span>
          </p>
        </div>
      </figcaption>
    </figure>
    {/* Runs as the page arrives, long before the app: see EARLY_START. */}
    <script dangerouslySetInnerHTML={{ __html: EARLY_START }} />
    </>
  );
}

const BrushArt = () => (
  <svg viewBox="0 0 40 120" width="22" height="66">
    {/* Lit from the upper left: each part is shaded round (a lighter band
        on the lit side, darker toward the far edge), with a glint on the
        metal ferrule - drawn once, so the shading costs nothing to move. */}
    <defs>
      <linearGradient id="hb-wood" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#6e4626" />
        <stop offset="0.3" stopColor="#c48a52" />
        <stop offset="0.55" stopColor="#9b6a3c" />
        <stop offset="1" stopColor="#5a3820" />
      </linearGradient>
      <linearGradient id="hb-metal" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8d8679" />
        <stop offset="0.28" stopColor="#f4efe4" />
        <stop offset="0.5" stopColor="#c9c2b4" />
        <stop offset="1" stopColor="#77705f" />
      </linearGradient>
      <linearGradient id="hb-hair" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#5a3f26" />
        <stop offset="0.35" stopColor="#9a744c" />
        <stop offset="1" stopColor="#4a321e" />
      </linearGradient>
    </defs>
    <path d="M20 118C17 108 16 86 17 62H23C24 86 23 108 20 118Z" fill="url(#hb-wood)" stroke="#4F3A2A" strokeWidth="1.4" />
    <path d="M18.6 66C18.2 84 18.6 100 19.6 110" fill="none" stroke="#f3d3a8" strokeOpacity="0.55" strokeWidth="0.9" strokeLinecap="round" />
    <path d="M16 46H24V64H16Z" fill="url(#hb-metal)" stroke="#4F3A2A" strokeWidth="1.4" />
    <path d="M16.6 51H23.4M16.6 58H23.4" stroke="#6f6857" strokeOpacity="0.5" strokeWidth="0.8" />
    <path d="M16 46C14 30 17 12 20 2C23 12 26 30 24 46Z" fill="url(#hb-hair)" stroke="#4F3A2A" strokeWidth="1.4" />
    <path className="hero-brush-tip" d="M17 22C18 13 19 7 20 2C21 7 22 13 23 22Z" />
    <path d="M18.4 20C18.8 13 19.3 8 19.9 4" fill="none" stroke="#e8a07c" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);
