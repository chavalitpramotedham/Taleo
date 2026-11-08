"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterDef, Page, Segment, SegmentResponse, Story } from "@/lib/types";
import { allPages, castFor, pageKey } from "@/lib/story-utils";
import { ageLevel, motionForAge } from "@/lib/actions";
import { shareUrl } from "@/lib/share";
import { publishToGallery } from "@/lib/gallery-client";
import { usePaintings } from "@/lib/usePaintings";
import { cancelSpeech, prefetchSpeech, setSpeechStory, speakText, unlockSpeech } from "@/lib/speech";
import { composePainting } from "@/lib/art/compose";
import { Painting, CharacterPortrait, InteractivePainting, type InteractivePaintingHandle, type TapTarget } from "./art/Painting";
import { DictateButton } from "./DictateButton";
import { RateAndComment } from "./RateAndComment";
import { MusicControl } from "./MusicControl";
import { MoonIcon, NightLamp } from "./NightLamp";
import { LeafLoader, Ornament, ShareIcon, SpeechIcon, MapleMark } from "./Icons";

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
  /** Read-only stories whose later paintings are still loading in the
   *  background: show a gentle placeholder for those pages, not a sketch. */
  picturesPending?: boolean;
}

export function StoryReader({ story, update, readOnly = false, onSaveCopy, picturesPending = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [customIdea, setCustomIdea] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(false);

  // ---------------------------------------------------------------- night mode
  // A cosy, dim bedtime theme for the storybook (remembered on this device).
  // It darkens the whole page while the reader is open; a little lamp drops
  // in over the book. Switching off lets the lamp rise away first.
  const [night, setNight] = useState(false);
  const [lampLeaving, setLampLeaving] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("taleo.night") === "1") setNight(true);
    } catch {}
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (night) root.dataset.night = "1";
    else delete root.dataset.night;
    return () => {
      delete root.dataset.night;
    };
  }, [night]);
  const fadeTheme = () => {
    const root = document.documentElement;
    root.classList.add("theme-fading");
    window.setTimeout(() => root.classList.remove("theme-fading"), 900);
  };
  const toggleNight = () => {
    if (lampLeaving) return;
    try {
      localStorage.setItem("taleo.night", night ? "0" : "1");
    } catch {}
    if (!night) {
      fadeTheme();
      setNight(true);
      return;
    }
    setLampLeaving(true);
    window.setTimeout(() => {
      fadeTheme();
      setNight(false);
      setLampLeaving(false);
    }, 420);
  };
  const [loadingLine, setLoadingLine] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const storyRef = useRef(story);
  storyRef.current = story;
  const started = useRef(false);
  const paintingRef = useRef<InteractivePaintingHandle>(null);

  const views: View[] = useMemo(() => {
    const v: View[] = [];
    let number = 0;
    story.segments.forEach((seg, si) => {
      seg.pages.forEach((page, pi) => v.push({ kind: "page", page, seg: si, n: pi, number: ++number }));
      if (seg.choice) v.push({ kind: "choice", seg: si });
    });
    if (busy) v.push({ kind: "loading" });
    else if (error) v.push({ kind: "error" });
    else if (story.status === "complete") v.push({ kind: "end" });
    return v;
  }, [story, busy, error]);

  const view = views[Math.min(index, views.length - 1)];
  const lastIndex = views.length - 1;
  const totalPages = views.filter((v) => v.kind === "page").length;

  // The picture shown alongside choices / endings is the most recent page's.
  const lastPage = [...views.slice(0, index + 1)].reverse().find((v): v is Extract<View, { kind: "page" }> => v.kind === "page");
  const shown = view?.kind === "page" ? view : lastPage;
  const focus = shown ? pageKey(shown.seg, shown.n) : null;

  const { live, failed, retry, painting } = usePaintings(story, update, focus, !readOnly);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  // ---------------------------------------------------------------- writing
  const generate = useCallback(
    async (s: Story) => {
      setBusy(true);
      setError(null);
      const body =
        s.segments.length === 0
          ? { kind: "start", age: s.age, minutes: s.minutes, theme: s.theme, hero: s.hero, companions: s.companions }
          : {
              kind: "continue",
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
      try {
        const res = await fetch("/api/story", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "The story got stuck. Let's try again!");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        const handle = (event: { type: string } & Record<string, unknown>) => {
          if (event.type === "error") throw new Error((event.error as string) || "The story got stuck. Let's try again!");
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
              cast: [...baseCast, ...data.newCharacters],
              segments: [
                ...cur.segments.slice(0, base),
                { ...data.segment, pages: keepSvgs(data.segment.pages, cur.segments[base]) },
              ],
              status: data.ending ? "complete" : "in-progress",
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
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
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
  const [outgoing, setOutgoing] = useState<{ picture: React.ReactNode; words: React.ReactNode; dir: 1 | -1; n: number } | null>(null);
  const currentContentRef = useRef<{ picture: React.ReactNode; words: React.ReactNode }>({ picture: null, words: null });
  const indexRef = useRef(index);
  indexRef.current = index;
  /** True while sitting on a choice the child hasn't answered: no reading ahead. */
  const forwardBlockedRef = useRef(false);
  const flipCount = useRef(0);
  const turnTo = useCallback(
    (target: number, opts: { force?: boolean } = {}) => {
      const from = indexRef.current;
      const to = Math.max(0, Math.min(lastIndex, target));
      if (to === from) return;
      if (to > from && forwardBlockedRef.current && !opts.force) return;
      flipCount.current += 1;
      setOutgoing({ ...currentContentRef.current, dir: to > from ? 1 : -1, n: flipCount.current });
      indexRef.current = to;
      setIndex(to);
    },
    [lastIndex],
  );
  const go = useCallback((d: number) => turnTo(indexRef.current + d), [turnTo]);

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
    setCustomIdea("");
    (document.activeElement as HTMLElement | null)?.blur();
    void generate(next);
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index]);

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
    if (Math.abs(dx) < (fast ? 30 : 50) || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    go(dx < 0 ? 1 : -1);
  };

  // ---------------------------------------------------------------- read aloud
  const speak = useCallback((text: string) => speakText(text, { kind: "page" }), []);

  useEffect(() => {
    if (!readAloud || !view) return;
    if (view.kind === "page") speak([view.page.aside, view.page.text].filter(Boolean).join(" "));
    if (view.kind === "choice") {
      const c = story.segments[view.seg].choice;
      if (c) speak(`${c.prompt} ${c.options.map((o) => o.label).join("? Or ")}?`);
    }
    if (view.kind === "end") speak("The end.");
  }, [readAloud, view, speak, story.segments]);

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
    await ensurePublished().catch(() => {});
    await copyToClipboard(shareLink());
  };

  const share = async () => {
    await ensurePublished().catch(() => {});
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
  let picture: React.ReactNode;
  if (!shown) {
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
          <InteractivePainting
            ref={paintingRef}
            svg={svg}
            title={shown.page.picture || shown.page.text}
            className={partial && !done ? "painting live" : "painting"}
            live={Boolean(partial && !done)}
            target={tapTarget(shown.page, [story.hero, ...story.companions, ...story.cast], story.age)}
          />
        ) : readOnly && picturesPending ? (
          <div className="picture-wait">
            <LeafLoader size={44} />
          </div>
        ) : null}
        {!svg && (
          <div className="picture-wait" aria-live="polite">
            <LeafLoader size={36} />
            <span>The illustrator is painting this page…</span>
          </div>
        )}
        {!done && partial && <div className="painting-badge">Painting…</div>}
        {!done && !readOnly && failed[key] && !painting(key) && (
          <button className="painting-badge retry" onClick={() => retry(key)}>
            Paint this page again
          </button>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------- words
  let words: React.ReactNode = null;
  if (!view || view.kind === "loading") {
    words = (
      <div className="loading" aria-live="polite">
        <p className="once">{story.segments.length === 0 ? "Once upon a time…" : "And then…"}</p>
        <LeafLoader size={48} />
        <p className="meta">{LOADING_LINES[loadingLine]}</p>
      </div>
    );
  } else if (view.kind === "error") {
    words = (
      <div className="choice-wrap">
        <p className="choice-prompt">Oh dear, the pages stuck together.</p>
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
          {withTappableWord(view.page.text, view.page.action?.word, () => paintingRef.current?.play())}
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
              <input
                className="input"
                value={customIdea}
                maxLength={160}
                placeholder="Say it out loud, or type your own idea…"
                onChange={(e) => setCustomIdea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && choose(customIdea, true)}
                aria-label="Your own idea for what happens next"
              />
              <button className="btn btn-primary" disabled={!customIdea.trim() || busy} onClick={() => choose(customIdea, true)}>
                Go
              </button>
            </div>
            <p className="divider-label">Or pick one</p>
            <div className="options">
              {c.options.map((o, i) => (
                <button key={o.label} className="option" disabled={busy} onClick={() => choose(o.label, false)}>
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
        <div className="end-actions">
          <button className="btn btn-soft" onClick={() => turnTo(0, { force: true })}>
            Read it again
          </button>
          <button className="btn btn-soft" onClick={copyLink}>
            Copy link
          </button>
          {readOnly
            ? onSaveCopy && (
                <button className="btn btn-primary" onClick={onSaveCopy}>
                  <MapleMark />
                  Keep this story
                </button>
              )
            : (
                <button className="btn btn-primary" onClick={share}>
                  <MapleMark />
                  Share
                </button>
              )}
          <Link className="btn btn-soft" href="/create">
            A new story
          </Link>
        </div>
        {story.demo && <p className="demo-note">Demo story: add an Anthropic API key for stories written and painted by Claude.</p>}
      </div>
    );
  }

  const atChoiceUnanswered = view?.kind === "choice" && !story.segments[view.seg].chosen;
  forwardBlockedRef.current = atChoiceUnanswered;
  const canBack = index > 0;
  const canForward = index < lastIndex && !atChoiceUnanswered;
  const position = view?.kind === "page" ? `Page ${view.number} of ${totalPages}` : view?.kind === "choice" ? "Your turn" : view?.kind === "end" ? "The End" : "";
  const jumpable = views
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: Extract<View, { kind: "page" | "choice" | "end" }>; i: number } => x.v.kind === "page" || x.v.kind === "choice" || x.v.kind === "end");
  const jumpLabel = (v: Extract<View, { kind: "page" | "choice" | "end" }>) =>
    v.kind === "page" ? `Page ${v.number}` : v.kind === "choice" ? "Your turn" : "The End";

  // Remember what's on the page right now, so the next go() can hand a
  // snapshot of it to the outgoing flip layer.
  currentContentRef.current = { picture, words };

  return (
    <div className={`reader age-${story.age}`}>
      <div className="reader-top">
        <h1 className="reader-title">{story.title || "A new story"}</h1>
        <div className="reader-tools">
          <MusicControl />
          <button
            className={`icon-btn ${night ? "on" : ""}`}
            onClick={toggleNight}
            aria-pressed={night}
            aria-label={night ? "Turn off night mode" : "Turn on night mode"}
            title={night ? "Night mode on" : "Night mode"}
          >
            <MoonIcon on={night} />
          </button>
          <button
            className={`icon-btn ${readAloud ? "on" : ""}`}
            onClick={() => {
              if (readAloud) cancelSpeech();
              else unlockSpeech();
              setReadAloud((r) => !r);
            }}
            aria-pressed={readAloud}
            aria-label={readAloud ? "Stop reading aloud" : "Read aloud"}
            title={readAloud ? "Stop reading aloud" : "Read to me"}
          >
            <SpeechIcon on={readAloud} />
          </button>
          {!readOnly && story.status === "complete" && (
            <button className="icon-btn" onClick={share} aria-label="Share story" title="Share">
              <ShareIcon />
            </button>
          )}
        </div>
      </div>

      <div className="book" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="book-art">{picture}</div>
        <div className="book-text">{words}</div>
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
              <div className="book-text">{outgoing.words}</div>
            </div>
          </>
        )}
        {night && <NightLamp leaving={lampLeaving} />}
      </div>

      <nav className="reader-nav" aria-label="Turn the page">
        <button className="nav-btn nav-btn-prev" onClick={() => go(-1)} disabled={!canBack} aria-label="Previous page">
          ‹
        </button>
        <button className="reader-index" onClick={() => setOverviewOpen(true)} aria-label="Jump to a page" disabled={jumpable.length < 2}>
          {position}
        </button>
        <button className="nav-btn nav-btn-next" onClick={() => go(1)} disabled={!canForward} aria-label="Next page">
          ›
        </button>
      </nav>
      {overviewOpen && (
        <div className="modal-backdrop" onClick={() => setOverviewOpen(false)}>
          <div className="modal-panel overview-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Jump to a page">
            <div className="modal-head">
              <h3>Jump to a page</h3>
              <button type="button" className="icon-btn" onClick={() => setOverviewOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="overview-strip" ref={stripRef}>
              {jumpable.map(({ v, i }) => {
                const svg = v.kind === "page" ? v.page.svg || composePainting(v.page, castFor(story, v.page)) : null;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`overview-item ${i === index ? "current" : ""}`}
                    aria-current={i === index ? "page" : undefined}
                    onClick={() => {
                      setOverviewOpen(false);
                      turnTo(i, { force: true });
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
      {view?.kind === "end" && (
        <RateAndComment
          storyId={story.id}
          initial={{ ratingSum: story.ratingSum ?? 0, ratingCount: story.ratingCount ?? 0 }}
          prepare={readOnly ? undefined : ensurePublished}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
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

/** Render page text with the key word (and its endings: hop → hopped) as a tappable button. */
function withTappableWord(text: string, word: string | undefined, onTap: () => void): React.ReactNode {
  if (!word) return text;
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(^|[^\\p{L}])(${escaped}[\\p{L}']*)`, "iu").exec(text);
  if (!m) return text;
  const start = m.index + m[1].length;
  const found = m[2];
  return (
    <>
      {text.slice(0, start)}
      <button type="button" className="word-tap" onClick={onTap} title={`Tap to hear “${found}”`}>
        {found}
      </button>
      {text.slice(start + found.length)}
    </>
  );
}
