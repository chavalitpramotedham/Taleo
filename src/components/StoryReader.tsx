"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CharacterDef, Page, Segment, SegmentResponse, Story } from "@/lib/types";
import { allPages, castFor, pageKey } from "@/lib/story-utils";
import { ageLevel, motionForAge } from "@/lib/actions";
import { shareUrl } from "@/lib/share";
import { publishToGallery } from "@/lib/gallery-client";
import { useMarkMaking } from "@/lib/making";
import { usePaintings } from "@/lib/usePaintings";
import { holdAudioOpen, wakeAudio } from "@/lib/audio-context";
import { cancelSpeech, onSpeechProgress, prefetchSpeech, setSpeechStory, speakText, unlockSpeech, type SpeechProgress } from "@/lib/speech";
import { composePainting } from "@/lib/art/compose";
import { Painting, CharacterPortrait, InteractivePainting, type InteractivePaintingHandle, type TapTarget } from "./art/Painting";
import { DictateButton } from "./DictateButton";
import { BookCover, coverStyle } from "./BookCover";
import { GrowingInput } from "./GrowingInput";
import { RateAndComment } from "./RateAndComment";
import { MusicControl } from "./MusicControl";
import { ReadAloudControl } from "./ReadAloudControl";
import { LeafLoader, LinkIcon, Ornament, ReplayIcon, ShareIcon } from "./Icons";
import { StoryProgressBar, countShapes } from "./StoryProgressBar";
import { logReadingToday } from "@/lib/reading-client";
import { markJustFinished } from "@/lib/ideas";
import { useSession } from "next-auth/react";
import { LimitDialog, type LimitNotice } from "./LimitDialog";

/** Strokes a page's painting needs before the waiting page opens onto it. */
const RELEASE_SHAPES = 70;
/** The longest the story waits for a picture once the words are there:
 *  past this the book opens (or the next part begins) and the picture
 *  finishes on the page. Nothing a painter does can hold up the reading. */
const PICTURE_WAIT_MS = 20_000;

type View =
  | { kind: "page"; page: Page; seg: number; n: number; number: number }
  | { kind: "choice"; seg: number }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "end" };

const LOADING_LINES = [
  "Dipping the pen in the ink…",
  "Mixing the watercolours…",
  "Asking the characters what happens next…",
  "Finding just the right words…",
  "Adding a sprinkle of giggles…",
];

interface Props {
  story: Story;
  update?: (fn: (s: Story) => Story) => void;
  readOnly?: boolean;
  onSaveCopy?: () => void;
  /** The keep-a-copy button's words, when not the usual "Keep this story". */
  saveCopyLabel?: string;
  /** Read-only stories whose later paintings are still loading in the
   *  background: show a gentle placeholder for those pages, not a sketch. */
  picturesPending?: boolean;
}

const TEXT_SIZE_KEY = "taleo.textSize";
const TEXT_SIZES = [0.8, 0.9, 1, 1.12, 1.25, 1.4];

export function StoryReader({ story, update, readOnly = false, onSaveCopy, saveCopyLabel, picturesPending = false }: Props) {
  const [busy, setBusy] = useState(false);
  // A brand-new story starts as a closed book (see BookCover): its cover
  // fills in while the first page is written and painted, then it swings
  // open into the story.
  // Every story starts on its cover (a new one stays there while it's
  // written and painted, then opens by itself; any other is opened with
  // Next, a swipe or the button). It's the page before page 1: Previous
  // from page 1, or "Cover" in the page list, closes the book again.
  const [cover, setCover] = useState<"closed" | "opening" | "open">("closed");
  const [isNew] = useState(() => !readOnly && story.segments.length === 0);
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (cover === "open") setHasOpened(true);
  }, [cover]);
  // Revisiting (a finished story reopened, or someone else's): sharing is
  // always to hand at the top. While a story is first being made, it's
  // offered at the end instead.
  const [revisit] = useState(() => readOnly || story.status === "complete");
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<LimitNotice | null>(null);
  // (closing the dialog keeps the kinder heading on the page behind it)
  const [limitOpen, setLimitOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [customIdea, setCustomIdea] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [voiceTick, setVoiceTick] = useState(0);
  // While reading aloud, keep the phone's audio from parking between pages.
  useEffect(() => {
    holdAudioOpen(readAloud);
    return () => holdAudioOpen(false);
  }, [readAloud]);
  // The words' size, chosen with the A− / A+ control and remembered on this
  // device (a scale on the age level's own size).
  const [textSize, setTextSize] = useState(1);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(TEXT_SIZE_KEY));
      if (TEXT_SIZES.includes(v)) setTextSize(v);
    } catch {}
  }, []);
  const changeTextSize = (d: 1 | -1) =>
    setTextSize((cur) => {
      const i = Math.max(0, Math.min(TEXT_SIZES.length - 1, TEXT_SIZES.indexOf(cur) + d));
      const next = TEXT_SIZES[i < 0 ? 2 : i];
      try {
        localStorage.setItem(TEXT_SIZE_KEY, String(next));
      } catch {}
      return next;
    });


  const [loadingLine, setLoadingLine] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const storyRef = useRef(story);
  storyRef.current = story;
  const started = useRef(false);
  const paintingRef = useRef<InteractivePaintingHandle>(null);

  // After a decision, the story waits on its loading page ("And then…")
  // until the next page's words AND picture are ready, then moves on - so
  // the child never lands on a half-made page with the voice starting.
  const [holdSeg, setHoldSeg] = useState<number | null>(null);
  // When the current wait began (for the progress bar's easing).
  const [progressStart, setProgressStart] = useState(() => Date.now());

  const views: View[] = useMemo(() => {
    const v: View[] = [];
    let number = 0;
    story.segments.forEach((seg, si) => {
      if (holdSeg !== null && si >= holdSeg) return;
      seg.pages.forEach((page, pi) => v.push({ kind: "page", page, seg: si, n: pi, number: ++number }));
      if (seg.choice) v.push({ kind: "choice", seg: si });
    });
    if (busy || holdSeg !== null) v.push({ kind: "loading" });
    else if (error) v.push({ kind: "error" });
    else if (story.status === "complete") v.push({ kind: "end" });
    return v;
  }, [story, busy, error, holdSeg]);


  const view = views[Math.min(index, views.length - 1)];
  const lastIndex = views.length - 1;
  const totalPages = views.filter((v) => v.kind === "page").length;

  // The picture shown alongside choices / endings is the most recent page's.
  const lastPage = [...views.slice(0, index + 1)].reverse().find((v): v is Extract<View, { kind: "page" }> => v.kind === "page");
  const shown = view?.kind === "page" ? view : lastPage;
  // (while waiting on the next part, its first page is the one to watch,
  // so its painting's progress shows on the waiting page)
  const focus = holdSeg !== null ? pageKey(holdSeg, 0) : shown ? pageKey(shown.seg, shown.n) : null;

  const { live, failed, retry, painting } = usePaintings(story, update, focus, !readOnly);
  // The menu's maple leaf glows while this story is still being made:
  // its words unfinished, or a picture of it yet to be painted.
  useMarkMaking(
    !readOnly &&
      (story.status !== "complete" || story.segments.some((sg, si) => sg.pages.some((p, pi) => !p.svg && !failed[pageKey(si, pi)]))),
  );

  // Let the held part through once its first page is painted (a moment's
  // grace so the picture is there when it appears), or 20s after its first
  // words arrive (a slow painting never keeps the story waiting: the
  // picture finishes on the page), or if writing or painting it failed.
  const heldFirst = holdSeg !== null ? story.segments[holdSeg]?.pages[0] : undefined;
  // (whether it's there at all - the page itself is a new object with every
  // word that streams in, which used to start the 20s over each time)
  const heldMissing = holdSeg !== null && !story.segments[holdSeg];
  const heldHasWords = Boolean(heldFirst);
  const heldHasPicture = Boolean(heldFirst?.svg);
  const heldFailed = holdSeg !== null && Boolean(failed[pageKey(holdSeg, 0)]);
  // Once its painting is well under way (the scene and its characters
  // laid in), the page opens and the painting finishes in front of the
  // reader - about half the wait, with nothing half-empty to land on.
  const heldPainted = holdSeg !== null && countShapes(live[pageKey(holdSeg, 0)]) >= RELEASE_SHAPES;
  useEffect(() => {
    if (holdSeg === null) return;
    if (error || (!busy && heldMissing) || heldFailed) return setHoldSeg(null);
    if (heldHasPicture || heldPainted) {
      const t = window.setTimeout(() => setHoldSeg(null), 350);
      return () => window.clearTimeout(t);
    }
    if (heldHasWords) {
      const t = window.setTimeout(() => setHoldSeg(null), PICTURE_WAIT_MS);
      return () => window.clearTimeout(t);
    }
    // (story.segments is only read for "is the part there", which
    // `missing` carries: listing it would restart the clock on every word)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdSeg, heldHasWords, heldHasPicture, heldPainted, heldFailed, error, busy, heldMissing]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  // ---------------------------------------------------------------- the cover
  const firstPage = story.segments[0]?.pages[0];
  const openBook = useCallback(() => {
    setCover((c) => (c === "closed" ? "opening" : c));
  }, []);
  const closeBook = useCallback(() => {
    cancelSpeech();
    setCover("closed");
  }, []);
  useEffect(() => {
    if (cover !== "opening") return;
    const t = window.setTimeout(() => setCover("open"), 1250);
    return () => window.clearTimeout(t);
  }, [cover]);
  // Open by itself once the first page is painted - or well under way, so
  // it finishes in front of the reader rather than keeping them waiting
  // (see RELEASE_SHAPES) - or if something went wrong.
  const firstUnderWay = countShapes(live[pageKey(0, 0)]) >= RELEASE_SHAPES;
  const firstReady = Boolean(firstPage?.svg) || firstUnderWay;
  const firstHasWords = Boolean(firstPage);
  const firstFailed = Boolean(failed[pageKey(0, 0)]);
  useEffect(() => {
    if (cover !== "closed" || !isNew || hasOpened) return;
    if (error || firstFailed) return openBook();
    // (with the words there but no picture yet, the book still opens after
    // a short wait: a slow painter never keeps the story shut)
    if (!firstReady && !firstHasWords) return;
    const t = window.setTimeout(openBook, firstReady ? 900 : PICTURE_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [cover, firstReady, firstHasWords, firstFailed, error, openBook, isNew, hasOpened]);

  // ---------------------------------------------------------------- writing
  // Leaving the story cancels a segment still being written: it couldn't be
  // saved any more, and cancelling stops the paid work straight away.
  const life = useRef<AbortController | null>(null);
  useEffect(() => {
    life.current = new AbortController();
    return () => {
      life.current?.abort();
      // If this reader comes back (React remounts it in development), let
      // it start the opening segment afresh.
      started.current = false;
    };
  }, []);

  const generate = useCallback(
    async (s: Story) => {
      setBusy(true);
      setProgressStart(Date.now());
      setError(null);
      setLimit(null);
      const body =
        s.segments.length === 0
          ? { kind: "start", age: s.age, minutes: s.minutes, theme: s.theme, hero: s.hero, companions: s.companions }
          : {
              kind: "continue",
              // (the server's ticket for the part after these - see server/tickets)
              ticket: s.ticket,
              story: {
                age: s.age,
                minutes: s.minutes,
                theme: s.theme,
                world: s.world,
                moral: s.moral,
                title: s.title,
                hero: s.hero,
                companions: s.companions,
                cast: s.cast,
                segments: s.segments.map((g) => ({ ...g, pages: g.pages.map((p) => ({ ...p, svg: null })) })),
              },
            };
      // The new segment streams in page by page: the reader can start on
      // its first page (and its picture starts painting) while the rest is
      // still being written. The finished, validated segment then replaces
      // the provisional one - keeping any paintings already done.
      const base = s.segments.length;
      const baseCast = s.cast;
      const keepSvgs = (pages: Page[], prev: Segment | undefined) =>
        pages.map((p, i) => ({ ...p, svg: prev?.pages[i]?.text === p.text ? (prev.pages[i].svg ?? null) : (p.svg ?? null) }));
      let shown = false;
      const signal = life.current?.signal;
      try {
        const res = await fetch("/api/story", {
          signal,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; limited?: string; plan?: string };
          // The plan's allowance for new stories is used up: say so
          // properly, with what can be done about it.
          if (res.status === 429 && data.error && (data.limited === "story" || data.limited === "start")) {
            setLimit({ limited: data.limited, plan: data.plan, message: data.error });
            setLimitOpen(true);
          }
          throw new Error(data.error || "The story got stuck. Let's try again!");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        const handle = (event: { type: string } & Record<string, unknown>) => {
          if (event.type === "error") throw new Error((event.error as string) || "The story got stuck. Let's try again!");
          if (event.type === "title") {
            const title = event.title as string;
            update?.((cur) => (cur.title ? cur : { ...cur, title }));
          }
          if (event.type === "pages") {
            const pages = event.pages as Page[];
            const newCharacters = event.newCharacters as CharacterDef[];
            shown = true;
            update?.((cur) => ({
              ...cur,
              cast: [...baseCast, ...newCharacters],
              segments: [...cur.segments.slice(0, base), { pages: keepSvgs(pages, cur.segments[base]), choice: null, chosen: null }],
            }));
          }
          if (event.type === "done") {
            const data = event.response as SegmentResponse;
            finished = true;
            update?.((cur) => ({
              ...cur,
              title: cur.title || data.title || `${cur.hero.name}'s Story`,
              world: cur.world || data.world || "",
              moral: cur.moral || data.moral,
              keyword: cur.keyword || data.keyword,
              cast: [...baseCast, ...data.newCharacters],
              segments: [
                ...cur.segments.slice(0, base),
                { ...data.segment, pages: keepSvgs(data.segment.pages, cur.segments[base]) },
              ],
              status: data.ending ? "complete" : "in-progress",
              ticket: data.ticket,
              demo: cur.demo || data.demo,
            }));
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) handle(JSON.parse(line));
          }
          if (done) break;
        }
        if (!finished) throw new Error("The story got stuck. Let's try again!");
      } catch (e) {
        // Never leave a half-written part behind: roll it back so "try
        // again" writes it afresh.
        if (shown) update?.((cur) => ({ ...cur, cast: baseCast, segments: cur.segments.slice(0, base) }));
        if (signal?.aborted) return; // cancelled because the reader closed
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [update],
  );

  useEffect(() => {
    if (!readOnly && story.segments.length === 0 && !started.current) {
      started.current = true;
      void generate(story);
    }
  }, [story, readOnly, generate]);

  // ---------------------------------------------------------------- page turning
  // Every page change goes through turnTo, so each one - buttons, arrow
  // keys, swipes, the page-jump grid, "Read it again", and the automatic
  // turns when a segment starts loading or lands - plays the page-turn.
  // A snapshot of the page being left is laid over the book as a single
  // leaf that turns away, revealing the new page (already rendered
  // beneath it).
  const [outgoing, setOutgoing] = useState<{ picture: React.ReactNode; words: React.ReactNode; art: string | null; dir: 1 | -1; n: number } | null>(null);
  const currentContentRef = useRef<{ picture: React.ReactNode; words: React.ReactNode; art: string | null }>({ picture: null, words: null, art: null });
  const indexRef = useRef(index);
  indexRef.current = index;
  /** True while sitting on a choice the child hasn't answered: no reading ahead. */
  const forwardBlockedRef = useRef(false);
  const flipCount = useRef(0);
  // Safety net: the turning page always clears, even if its animation's
  // end is missed (a tab switch mid-turn, an interrupted animation).
  useEffect(() => {
    if (!outgoing) return;
    const t = window.setTimeout(() => setOutgoing(null), 1200);
    return () => window.clearTimeout(t);
  }, [outgoing]);
  const turnTo = useCallback(
    (target: number, opts: { force?: boolean } = {}) => {
      const from = indexRef.current;
      const to = Math.max(0, Math.min(lastIndex, target));
      if (to === from) return;
      if (to > from && forwardBlockedRef.current && !opts.force) return;
      flipCount.current += 1;
      setOutgoing({ ...currentContentRef.current, dir: to > from ? 1 : -1, n: flipCount.current });
      setPendingNext(false);
      indexRef.current = to;
      setIndex(to);
    },
    [lastIndex],
  );
  // Tapping Next onto a page that's still being written turns the page at
  // once, onto a waiting page (falling leaves where the picture will be);
  // the page itself is revealed there the moment it's ready.
  const [pendingNext, setPendingNext] = useState(false);
  const pendingRef = useRef(false);
  pendingRef.current = pendingNext;
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const coverRef = useRef(cover);
  coverRef.current = cover;
  const go = useCallback(
    (d: number) => {
      // The cover is the page before page 1.
      if (coverRef.current !== "open") {
        if (d > 0 && coverRef.current === "closed" && storyRef.current.segments[0]?.pages[0]) {
          indexRef.current = 0;
          setIndex(0);
          openBook();
        }
        return;
      }
      if (pendingRef.current) {
        // already turned onto the waiting page: Back turns back from it
        if (d > 0) return;
        flipCount.current += 1;
        setOutgoing({ ...currentContentRef.current, dir: -1, n: flipCount.current });
        setPendingNext(false);
        return;
      }
      if (d < 0 && indexRef.current === 0) return closeBook();
      const target = indexRef.current + d;
      if (d > 0 && !forwardBlockedRef.current && viewsRef.current[target]?.kind === "loading" && indexRef.current < target) {
        flipCount.current += 1;
        setOutgoing({ ...currentContentRef.current, dir: 1, n: flipCount.current });
        cancelSpeech();
        setPendingNext(true);
        return;
      }
      turnTo(target);
    },
    [turnTo, openBook, closeBook],
  );
  useEffect(() => {
    if (!pendingNext) return;
    const next = views[index + 1];
    if (!next) return setPendingNext(false);
    if (next.kind === "loading") return;
    // already turned: just reveal it (no second page-turn)
    setPendingNext(false);
    indexRef.current = index + 1;
    setIndex(index + 1);
  }, [pendingNext, views, index]);

  // When a new segment lands, turn to its first page.
  const segCount = story.segments.length;
  const prevSegCount = useRef(segCount);
  useEffect(() => {
    if (segCount > prevSegCount.current) {
      const firstNew = views.findIndex((v) => v.kind === "page" && v.seg === segCount - 1);
      if (firstNew >= 0) turnTo(firstNew, { force: true });
    }
    prevSegCount.current = segCount;
  }, [segCount, views, turnTo]);

  // When writing starts, turn once to the "writing" page. (Not on every
  // page that streams in after - that would pull the reader away from the
  // page they're on.)
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy && !wasBusy.current) turnTo(views.length - 1, { force: true });
    wasBusy.current = busy;
  }, [busy, views.length, turnTo]);
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setLoadingLine((n) => (n + 1) % LOADING_LINES.length), 2600);
    return () => window.clearInterval(t);
  }, [busy]);

  // Once a story is finished and every page is painted, it joins the public
  // story store - or, if it was already published early (to share or rate
  // it), the store copy is refreshed with the finished paintings.
  const publishedRef = useRef(false);
  useEffect(() => {
    if (readOnly || publishedRef.current || story.publishedPainted || story.status !== "complete") return;
    const pages = allPages(story);
    if (pages.length === 0 || !pages.every((p) => p.svg)) return;
    publishedRef.current = true;
    void publishToGallery(story).then((ok) => {
      if (ok) update?.((cur) => ({ ...cur, published: true, publishedPainted: true }));
    });
  }, [story, readOnly, update]);

  const choose = (text: string, custom: boolean) => {
    const t = text.trim();
    if (!t || busy) return;
    const segs = story.segments.map((s, i) => (i === story.segments.length - 1 ? { ...s, chosen: { text: t, custom } } : s));
    const next = { ...story, segments: segs };
    update?.(() => next);
    setHoldSeg(next.segments.length);
    setCustomIdea("");
    (document.activeElement as HTMLElement | null)?.blur();
    void generate(next);
  };

  // A tapped option lights up at once and holds for a beat (so it's clear
  // what was chosen) before the book turns to the waiting page.
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (text: string, custom: boolean) => {
    if (picked || busy || !text.trim()) return;
    setPicked(text);
    window.setTimeout(() => {
      setPicked(null);
      choose(text, custom);
    }, 550);
  };

  // ---------------------------------------------------------------- navigation
  // The page-jump strip opens with the page you're on centred in it.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!overviewOpen) return;
    const strip = stripRef.current;
    const current = strip?.querySelector<HTMLElement>(".overview-item.current");
    if (strip && current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  }, [overviewOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overviewOpen) return setOverviewOpen(false);
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName) || overviewOpen) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, overviewOpen]);

  // Finishing any story (yours or the library's) makes today a reading day
  // on your Home chart - logged at most once a day.
  const { data: readerSession } = useSession();
  const readerId = readerSession?.user?.id;
  useEffect(() => {
    if (!readerId || cover !== "open") return;
    if (view?.kind === "end") logReadingToday(readerId, story.id);
  }, [readerId, cover, view?.kind, story.id]);
  // A story of one's own, just made and read to its end: back on the
  // bookshelf there's an idea waiting for the next one.
  useEffect(() => {
    if (!revisit && cover === "open" && view?.kind === "end") markJustFinished();
  }, [revisit, cover, view?.kind]);

  // A new page keeps the reader's scroll, so the picture stays where it
  // was - unless the words had been scrolled up under the stuck picture:
  // then just enough is undone to show the new page's first line in full.
  // (On wide screens only the words column scrolls: it starts at the top.)
  const shownAt = useRef("");
  useLayoutEffect(() => {
    const art = document.querySelector(".book > .book-art");
    const text = document.querySelector<HTMLElement>(".book > .book-text");
    if (!art || !text) return;
    const at = `${index}-${pendingNext}`;
    if (shownAt.current !== at) {
      shownAt.current = at;
      text.scrollTop = 0;
      const hidden = art.getBoundingClientRect().bottom - text.getBoundingClientRect().top;
      if (hidden > 0.5) window.scrollBy({ top: -hidden, behavior: "instant" as ScrollBehavior });
    }
    // The turning page shows its picture just where the page's own picture
    // sits on screen (stuck under the menu bar or not), so it doesn't jump.
    const leafArt = document.querySelector<HTMLElement>(".flip-leaf > .book-art");
    const book = document.querySelector(".book");
    if (leafArt && book) leafArt.style.top = `${Math.max(0, art.getBoundingClientRect().top - book.getBoundingClientRect().top)}px`;
  }, [index, pendingNext, outgoing?.n]);

  // A choice, the ending and "try again" hold more than fits under a stuck
  // picture on a phone (the three options sat below the fold, read through
  // a slit) - so there the picture scrolls with the page, and a choice
  // still waiting for its answer slides into view once the page has turned.
  const tallWords = cover === "open" && !pendingNext && (view?.kind === "choice" || view?.kind === "end" || view?.kind === "error");
  const awaitingChoice = cover === "open" && !pendingNext && view?.kind === "choice" && !readOnly && !story.segments[view.seg]?.chosen;
  useEffect(() => {
    if (!awaitingChoice) return;
    const t = setTimeout(() => {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector(".book > .book-text .options")?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    }, 900);
    return () => clearTimeout(t);
  }, [awaitingChoice, index]);

  // The menu bar's height, for the layout: an open book fills exactly the
  // screen below it, and on tall screens the picture stops just under it.
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".topbar");
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty("--topbar-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // Swipe to turn: right-to-left = next page, left-to-right = previous.
  // Only a clearly sideways, single-finger swipe counts, so scrolling a
  // tall page or pinching never turns it by accident.
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement;
    if (e.touches.length !== 1 || el.closest("input, textarea, select")) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) touchStart.current = null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const fast = Date.now() - start.t < 300;
    // A light flick (24px quick, 38px slow) turns the page forward; it
    // just needs to be more sideways than up-and-down. Going back takes a
    // deliberate drag - about three times as far, and clearly level - so
    // a thumb drifting across the page (or a child's hand) doesn't lose
    // the reader's place.
    const back = dx > 0;
    const need = back ? (fast ? 72 : 110) : fast ? 24 : 38;
    if (Math.abs(dx) < need || Math.abs(dx) < Math.abs(dy) * (back ? 2 : 1.25)) return;
    go(back ? -1 : 1);
  };


  // ---------------------------------------------------------------- read aloud
  const speak = useCallback((text: string) => speakText(text, { kind: "page" }), []);

  // The word being read right now, to light it up as the voice goes.
  const [spoken, setSpoken] = useState<SpeechProgress>(null);
  useEffect(() => onSpeechProgress(setSpoken), []);
  const readingAt = (page: Page) => {
    if (!spoken) return -1;
    const full = [page.aside, page.text].filter(Boolean).join(" ");
    if (spoken.text.replace(/\s+/g, " ").trim() !== full.replace(/\s+/g, " ").trim()) return -1;
    return spoken.at - (page.aside ? page.aside.length + 1 : 0);
  };

  // A new page waits for the page turn to settle, plus a breath, before
  // the reading starts (the previous page's reading stops at once);
  // switching read-aloud on starts almost straight away.
  const readFor = useRef<string | null>(null);
  const readTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(readTimer.current), []);
  useEffect(() => {
    if (!readAloud || !view || cover !== "open") {
      readFor.current = null;
      window.clearTimeout(readTimer.current);
      return;
    }
    let text = "";
    if (view.kind === "page") text = [view.page.aside, view.page.text].filter(Boolean).join(" ");
    if (view.kind === "choice") {
      const c = story.segments[view.seg].choice;
      if (c) text = `${c.prompt} ${c.options.map((o) => o.label).join("? Or ")}?`;
    }
    if (view.kind === "end") text = "The end.";
    // waiting on the next part after a choice: the choice, echoed back
    if (view.kind === "loading") {
      const last = story.segments[(holdSeg ?? story.segments.length) - 1];
      if (last?.chosen) text = `Great choice! ${last.chosen.custom ? "Your idea" : "You said"}: ${last.chosen.text}.`;
    }
    // Only when the words to read change (the page re-renders for other
    // reasons too, e.g. a painting arriving - that mustn't restart it).
    if (!text || text === readFor.current) return;
    const turned = readFor.current !== null;
    readFor.current = text;
    if (turned) cancelSpeech();
    window.clearTimeout(readTimer.current);
    // After a turn, a calm pause (the page settles and you look at the picture)
    // before the voice begins; turning read-aloud on starts almost at once.
    readTimer.current = window.setTimeout(() => speak(text), turned ? 2000 : 250);
  }, [readAloud, view, speak, story.segments, cover, voiceTick]);

  // Have the voice ready before it's needed: this page's tappable word, and
  // (when reading aloud) the next page's text.
  useEffect(() => {
    if (view?.kind === "page" && view.page.action?.word) prefetchSpeech(view.page.action.word, "word");
    const nextView = views[index + 1];
    if (readAloud && nextView?.kind === "page") prefetchSpeech([nextView.page.aside, nextView.page.text].filter(Boolean).join(" "));
  }, [view, views, index, readAloud]);

  useEffect(() => {
    setSpeechStory(story.id);
    return () => setSpeechStory(null);
  }, [story.id]);

  useEffect(() => () => cancelSpeech(), []);

  // ---------------------------------------------------------------- share
  /** Make sure the story is live in the public store before handing out its link.
   *  Idempotent (upsert), so it's safe to call even for a story read from the
   *  store itself, or an old pre-store share link that isn't published yet. */
  const ensurePublished = async () => {
    if (story.published) return;
    const ok = await publishToGallery(story);
    if (!ok) throw new Error("Couldn't publish the story.");
    update?.((cur) => ({ ...cur, published: true }));
  };

  const shareLink = () => shareUrl(story.id, window.location.origin);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied. Paste it anywhere to share.");
    } catch {
      window.prompt("Copy this link to share:", url);
    }
  };

  const copyLink = async () => {
    // (someone else's story is already in the library)
    if (!readOnly) await ensurePublished().catch(() => {});
    await copyToClipboard(shareLink());
  };

  const share = async () => {
    // Someone else's story is already in the library: just share its link.
    if (!readOnly) await ensurePublished().catch(() => {});
    const url = shareLink();
    const data = { title: story.title, text: `A Taleo story: “${story.title}”`, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    await copyToClipboard(url);
  };

  // ---------------------------------------------------------------- picture
  // A page turn starts the moment Next is tapped: the new page's painting
  // (slow to draw) waits under falling leaves until the turning page has
  // gone, then fades in - so the turn never waits on it.
  const artKey = pendingNext ? null : shown ? pageKey(shown.seg, shown.n) : null;
  const artHeld = pendingNext || Boolean(outgoing && artKey && outgoing.art !== artKey);
  let picture: React.ReactNode;
  if (artHeld) {
    picture = (
      <div className="picture-wait canvas-wait" aria-hidden>
        <span className="blank-canvas painted-edge" />
        <LeafLoader size={40} />
      </div>
    );
  } else if (!shown) {
    picture = (
      <div className="picture-wait">
        <CharacterPortrait character={story.hero} className="wait-portrait" />
      </div>
    );
  } else {
    const key = pageKey(shown.seg, shown.n);
    const done = shown.page.svg;
    const partial = live[key];
    const fallback = !done && ((readOnly && !picturesPending) || failed[key]) ? composePainting(shown.page, castFor(story, shown.page)) : null;
    const svg = done || partial || fallback;
    picture = (
      <>
        {svg ? (
          <>
            {/* The blank sheet stays under the picture as it arrives - painted
                onto while it streams in, then fading away once it's done -
                and the picture itself fades in over it, so it never pops. */}
            <span key={`sheet-${key}`} className={`blank-canvas painted-edge under-canvas ${partial && !done ? "" : "gone"}`} aria-hidden />
            <div key={`art-${key}`} className="art-fade">
              <InteractivePainting
                ref={paintingRef}
                svg={svg}
                title={shown.page.picture || shown.page.text}
                className={partial && !done ? "painting live" : "painting"}
                live={Boolean(partial && !done)}
                target={tapTarget(shown.page, [story.hero, ...story.companions, ...story.cast], story.age)}
              />
            </div>
          </>
        ) : (
          // a blank sheet in the painting's own soft watercolour shape,
          // with the leaves falling on it until the picture is ready
          <div className="picture-wait canvas-wait" aria-live="polite">
            <span className="blank-canvas painted-edge" aria-hidden />
            <LeafLoader size={40} />
            <span>The illustrator is painting this page…</span>
          </div>
        )}
        {!done && partial && (
          <div className="painting-badge" role="status">
            <LeafLoader size={21} />
            Painting…
          </div>
        )}
        {!done && !readOnly && failed[key] && !painting(key) && (
          <button className="painting-badge retry" onClick={() => retry(key)}>
            Paint this page again
          </button>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------- words
  // Progress of the part being made: written first, then its first page painted.
  const nextSeg = holdSeg ?? story.segments.length;
  const nextFirst = story.segments[nextSeg]?.pages[0];
  let words: React.ReactNode = null;
  if (pendingNext) {
    words = (
      <div className="loading next-wait" aria-live="polite">
        <p className="meta">The next page is on its way…</p>
      </div>
    );
  } else if (!view || view.kind === "loading") {
    // Waiting on the next part after a choice: echo it back, so there's
    // something to read (and read aloud) while it's written.
    // (the choice just made - it stays while the next part arrives)
    const lastSeg = story.segments[nextSeg - 1];
    const echo = lastSeg?.chosen && lastSeg.choice ? { prompt: lastSeg.choice.prompt, said: lastSeg.chosen.text, custom: lastSeg.chosen.custom } : null;
    words = (
      <div className="loading" aria-live="polite">
        {echo ? (
          <div className="chosen-echo">
            <p className="chosen-echo-prompt">{echo.prompt}</p>
            <p className="chosen-echo-great">Great choice!</p>
            <p className="chosen-echo-said">
              {echo.custom ? "Your idea" : "You said"} - <q>{echo.said}</q>
            </p>
          </div>
        ) : (
          <p className="once">{story.segments.length === 0 ? "Once upon a time…" : "And then…"}</p>
        )}
        <StoryProgressBar
          started={progressStart}
          painting={Boolean(nextFirst)}
          shapes={nextFirst?.svg ? null : countShapes(live[pageKey(nextSeg, 0)])}
          target={RELEASE_SHAPES}
          hint={LOADING_LINES[loadingLine]}
        />
      </div>
    );
  } else if (view.kind === "error") {
    words = (
      <div className="choice-wrap">
        <p className="choice-prompt">{limit ? "This story will have to wait a little." : "Oh dear, the pages stuck together."}</p>
        <p className="meta">{error}</p>
        <div>
          <button className="btn btn-primary" onClick={() => generate(storyRef.current)}>
            Try again
          </button>
        </div>
      </div>
    );
  } else if (view.kind === "page") {
    const first = view.number === 1;
    words = (
      <div key={`${view.seg}-${view.n}`} className="page-anim words">
        {view.page.aside && (
          <p className="aside">
            <span>The storyteller says:</span> {view.page.aside}
          </p>
        )}
        <p className={`story-text ${first ? "drop" : ""}`}>
          {withTappableWord(view.page.text, view.page.action?.word, () => paintingRef.current?.play(), readingAt(view.page))}
        </p>
        <p className="folio">— {view.number} —</p>
      </div>
    );
  } else if (view.kind === "choice") {
    const seg = story.segments[view.seg];
    const c = seg.choice!;
    words = (
      <div className="choice-wrap page-anim">
        <p className="choice-prompt">{c.prompt}</p>
        {seg.chosen ? (
          <>
            <p className="chosen-note">
              {seg.chosen.custom ? "Your idea: " : "You chose: "}
              <em>{seg.chosen.text}</em>
            </p>
            {index < lastIndex && (
              <div>
                <button className="btn btn-soft btn-sm" onClick={() => go(1)}>
                  See what happened
                </button>
              </div>
            )}
          </>
        ) : readOnly ? (
          <p className="meta">This story is still being written.</p>
        ) : (
          <>
            <div className="field-row">
              <DictateButton onText={setCustomIdea} label="Say your idea" />
              <GrowingInput
                value={customIdea}
                maxLength={160}
                placeholder="Say it out loud, or type your own idea…"
                onChange={setCustomIdea}
                onEnter={() => customIdea.trim() && !busy && !picked && pick(customIdea, true)}
                aria-label="Your own idea for what happens next"
              />
              <button className={`btn btn-primary ${picked && picked === customIdea ? "picked" : ""}`} disabled={!customIdea.trim() || busy || Boolean(picked)} onClick={() => pick(customIdea, true)}>
                Go
              </button>
            </div>
            <p className="divider-label">Or pick one</p>
            <div className="options">
              {c.options.map((o, i) => (
                <button
                  key={o.label}
                  className={`option ${picked === o.label ? "picked" : ""} ${picked && picked !== o.label ? "not-picked" : ""}`}
                  disabled={busy || Boolean(picked)}
                  aria-pressed={picked === o.label}
                  onClick={() => pick(o.label, false)}
                >
                  <span className="o-num">{["i", "ii", "iii", "iv"][i]}.</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  } else if (view.kind === "end") {
    words = (
      <div className="the-end page-anim">
        <p className="end-title">The End</p>
        <Ornament className="ornament" />
        {/* the rating sits right here on the page - stars and comment, or
            yours once rated - with the share buttons below */}
        <RateAndComment
          inline
          storyId={story.id}
          initial={{ ratingSum: story.ratingSum ?? 0, ratingCount: story.ratingCount ?? 0 }}
          prepare={readOnly ? undefined : ensurePublished}
          unpublished={!readOnly && !story.published}
        />
        {/* One main action in the middle (share it, or keep a copy of
            someone else's), with read-again and copy-link as quiet icons
            either side. */}
        <div className="end-actions">
          <button className="icon-btn end-icon" onClick={() => turnTo(0, { force: true })} aria-label="Read it again" title="Read it again">
            <ReplayIcon />
          </button>
          {/* The same ending for every story, yours or someone else's:
              share it, read it again, or copy its link. */}
          <button className="btn btn-primary end-main" onClick={share}>
            <ShareIcon />
            Share
          </button>
          <button className="icon-btn end-icon" onClick={copyLink} aria-label="Copy link" title="Copy link">
            <LinkIcon />
          </button>
        </div>
        {readOnly ? (
          <p className="end-links">
            {onSaveCopy && (
              <>
                <button type="button" className="end-back end-keep" onClick={onSaveCopy}>
                  {saveCopyLabel ?? "Keep a copy on my bookshelf"}
                </button>
                <span aria-hidden> · </span>
              </>
            )}
            <Link className="end-back" href="/store">
              Back to the Public Library
            </Link>
          </p>
        ) : (
          <Link className="end-back" href="/my-stories">
            Return to my bookshelf
          </Link>
        )}
        {story.demo && <p className="demo-note">Demo story: add an Anthropic API key for stories written and painted by Claude.</p>}
      </div>
    );
  }

  const atChoiceUnanswered = view?.kind === "choice" && !story.segments[view.seg].chosen;
  forwardBlockedRef.current = atChoiceUnanswered;
  const onCover = cover !== "open";
  const canBack = !onCover;
  const canForward = onCover ? cover === "closed" && Boolean(firstPage) : index < lastIndex && !atChoiceUnanswered;
  const position = onCover ? "Cover" : pendingNext ? "" : view?.kind === "page" ? `Page ${view.number} of ${totalPages}` : view?.kind === "choice" ? "Your turn" : view?.kind === "end" ? "The End" : "";
  const jumpable = views
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: Extract<View, { kind: "page" | "choice" | "end" }>; i: number } => x.v.kind === "page" || x.v.kind === "choice" || x.v.kind === "end");
  // A story picked up again part-way: its cover offers a way straight back
  // to the last page written (where the reading stopped), past the pages
  // already read. Only on the closed cover, and only if that saves a turn.
  const leftOff = !isNew && !revisit ? [...jumpable].reverse().find((x) => x.v.kind === "page") : undefined;
  const skipTo = cover === "closed" && leftOff && leftOff.v.kind === "page" && leftOff.v.number > 1 ? { i: leftOff.i, number: leftOff.v.number } : null;
  const jumpLabel = (v: Extract<View, { kind: "page" | "choice" | "end" }>) =>
    v.kind === "page" ? `Page ${v.number}` : v.kind === "choice" ? "Your turn" : "The End";

  // Remember what's on the page right now, so the next go() can hand a
  // snapshot of it to the outgoing flip layer.
  currentContentRef.current = { picture, words, art: artKey };

  const textSizeButtons = (
    <div className="text-size" role="group" aria-label="Text size">
      <button type="button" onClick={() => changeTextSize(-1)} disabled={textSize <= TEXT_SIZES[0]} aria-label="Smaller text">
        A<span aria-hidden>−</span>
      </button>
      <button type="button" onClick={() => changeTextSize(1)} disabled={textSize >= TEXT_SIZES[TEXT_SIZES.length - 1]} aria-label="Bigger text">
        A<span aria-hidden>+</span>
      </button>
    </div>
  );

  return (
    <div className={`reader age-${story.age}`} style={{ "--text-scale": textSize } as React.CSSProperties}>
      <div className="reader-top">
        {/* while the book is closed, its title is on the cover */}
        {cover !== "closed" && <h1 className="reader-title">{story.title || "A new story"}</h1>}
        <div className="reader-tools">
          <MusicControl />
          <ReadAloudControl
            on={readAloud}
            speaking={readAloud && spoken !== null}
            onToggle={() => {
              if (readAloud) cancelSpeech();
              else {
                unlockSpeech();
                wakeAudio();
              }
              setReadAloud((r) => !r);
            }}
            onVoiceChange={() => {
              // read the page again, in the new voice (and turn reading on)
              cancelSpeech();
              unlockSpeech();
              wakeAudio();
              readFor.current = null;
              setVoiceTick((t) => t + 1);
              setReadAloud(true);
            }}
          />
          {revisit && (
            <button className="icon-btn" onClick={share} aria-label="Share story" title="Share">
              <ShareIcon />
            </button>
          )}
        </div>
      </div>

      <div
        className={`book-stage ${cover}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {cover !== "closed" && (
      <div className={`book ${tallWords ? "tall-words" : ""}`}>
        <div className="book-art">{picture}</div>
        <div className="book-text">
          {cover === "open" && textSizeButtons}
          {words}
        </div>
        {outgoing && (
          <>
            <div key={`shade-${outgoing.n}`} className={`flip-shade flip-shade-${outgoing.dir > 0 ? "next" : "prev"}`} aria-hidden />
            <div
              key={`leaf-${outgoing.n}`}
              className={`flip-leaf flip-leaf-${outgoing.dir > 0 ? "next" : "prev"}`}
              aria-hidden
              onAnimationEnd={(e) => e.target === e.currentTarget && setOutgoing(null)}
            >
              <div className="book-art">{outgoing.picture}</div>
              <div className="book-text">
                {/* a still copy of the page's A−/A+ (it turns with the page) */}
                <div className="text-size" aria-hidden>
                  <button type="button" tabIndex={-1}>
                    A<span>−</span>
                  </button>
                  <button type="button" tabIndex={-1}>
                    A<span>+</span>
                  </button>
                </div>
                {outgoing.words}
              </div>
            </div>
          </>
        )}
      </div>
        )}
        {cover !== "open" && <BookCover story={story} isHeading={cover === "closed"} opening={cover === "opening"} canOpen={Boolean(firstPage)} ready={!isNew || hasOpened} onOpen={() => go(1)} />}
      </div>

      <nav className={`reader-nav ${cover === "opening" ? "hidden-until-open" : ""}`} aria-label="Turn the page">
        <button className="nav-btn nav-btn-prev" onClick={() => go(-1)} disabled={!canBack} aria-label="Previous page">
          ‹
        </button>
        <button className={`reader-index ${position ? "" : "is-empty"}`} onClick={() => setOverviewOpen(true)} aria-label="Jump to a page" disabled={jumpable.length < 1}>
          {position}
        </button>
        {skipTo && (
          <button
            type="button"
            className="nav-skip"
            onClick={() => {
              indexRef.current = skipTo.i;
              setIndex(skipTo.i);
              openBook();
            }}
          >
            <span className="nav-skip-label">Skip to page {skipTo.number}</span>
            <span className="nav-skip-btn" aria-hidden="true">
              »
            </span>
          </button>
        )}
        <button
          className={`nav-btn nav-btn-next ${skipTo ? "nav-btn-quiet" : ""}`}
          onClick={() => go(1)}
          disabled={!canForward || pendingNext}
          aria-label="Next page"
        >
          ›
        </button>
      </nav>
      {overviewOpen && (
        <div className="modal-backdrop" onClick={() => setOverviewOpen(false)}>
          <div className="modal-panel overview-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Jump to a page">
            <div className="modal-head">
              <h3>Jump to a page</h3>
              <span className="overview-head-btns">
                <button
                  type="button"
                  className="icon-btn overview-to-end"
                  onClick={() => {
                    const strip = stripRef.current;
                    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                    strip?.scrollTo({ left: strip.scrollWidth, behavior: calm ? "auto" : "smooth" });
                  }}
                  aria-label="Scroll to the last page"
                  title="To the last page"
                >
                  »
                </button>
                <button type="button" className="icon-btn" onClick={() => setOverviewOpen(false)} aria-label="Close">
                  ✕
                </button>
              </span>
            </div>
            <div className="overview-strip" ref={stripRef}>
              <button
                type="button"
                className={`overview-item ${onCover ? "current" : ""}`}
                aria-current={onCover ? "page" : undefined}
                onClick={() => {
                  setOverviewOpen(false);
                  closeBook();
                }}
              >
                <span className="overview-thumb overview-thumb-label overview-thumb-cover" style={coverStyle(story.id)}>
                  {story.title || "Cover"}
                </span>
                <span className="overview-caption">Cover</span>
              </button>
              {jumpable.map(({ v, i }) => {
                const svg = v.kind === "page" ? v.page.svg || composePainting(v.page, castFor(story, v.page)) : null;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`overview-item ${!onCover && i === index ? "current" : ""}`}
                    aria-current={!onCover && i === index ? "page" : undefined}
                    onClick={() => {
                      setOverviewOpen(false);
                      if (onCover) {
                        indexRef.current = i;
                        setIndex(i);
                        openBook();
                      } else turnTo(i, { force: true });
                    }}
                  >
                    {svg ? (
                      <Painting svg={svg} title={v.kind === "page" ? v.page.picture || v.page.text : ""} className="overview-thumb" vignette={false} />
                    ) : (
                      <span className="overview-thumb overview-thumb-label">{jumpLabel(v)}</span>
                    )}
                    {v.kind === "page" && <span className="overview-caption">Page {v.number}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {limit && limitOpen && <LimitDialog notice={limit} onClose={() => setLimitOpen(false)} />}
    </div>
  );
}

/** The page's tappable moment, in the form the painting needs. */
function tapTarget(page: Page, cast: CharacterDef[], age: string): TapTarget | null {
  const a = page.action;
  if (!a) return null;
  const who = cast.find((c) => c.id === a.target);
  return {
    word: a.word,
    // Gentle for toddlers, bigger and bolder as children get older.
    motion: motionForAge(a.motion, age),
    level: ageLevel(age),
    sound: a.sound,
    hint: who ? `Tap ${who.name}!` : `Tap the ${a.target}!`,
  };
}

/** Render page text with the key word (and its endings: hop → hopped) as a
 *  tappable button, and - while it's being read aloud - the word being
 *  read softly lit, karaoke-style (`reading` = its character index). */
function withTappableWord(text: string, word: string | undefined, onTap: () => void, reading = -1): React.ReactNode {
  let tapStart = -1;
  let found = "";
  if (word) {
    const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`(^|[^\\p{L}])(${escaped}[\\p{L}']*)`, "iu").exec(text);
    if (m) {
      tapStart = m.index + m[1].length;
      found = m[2];
    }
  }
  const tapEnd = tapStart + found.length;
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const m of text.matchAll(/\S+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (end <= pos) continue;
    out.push(text.slice(pos, start));
    const lit = reading >= start && reading < end;
    if (tapStart >= 0 && start <= tapStart && tapStart < end) {
      // the word containing the tappable word (keep its punctuation around it)
      out.push(
        <span key={start} className={lit ? "reading" : undefined}>
          {text.slice(start, tapStart)}
          <button type="button" className="word-tap" onClick={onTap} title={`Tap to hear “${found}”`}>
            {found}
          </button>
          {text.slice(tapEnd, Math.max(tapEnd, end))}
        </span>,
      );
      pos = Math.max(end, tapEnd);
      continue;
    }
    out.push(
      <span key={start} className={lit ? "reading" : undefined}>
        {m[0]}
      </span>,
    );
    pos = end;
  }
  out.push(text.slice(pos));
  return <>{out}</>;
}
