"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterDef, Page, SegmentResponse, Story } from "@/lib/types";
import { allPages, castFor, pageKey } from "@/lib/story-utils";
import { ageLevel, motionForAge } from "@/lib/actions";
import { storeUrl } from "@/lib/share";
import { publishToGallery } from "@/lib/gallery-client";
import { formatRating, useRating } from "@/lib/useRating";
import { usePaintings } from "@/lib/usePaintings";
import { cancelSpeech, speakText, unlockSpeech } from "@/lib/speech";
import { composePainting } from "@/lib/art/compose";
import { Painting, CharacterPortrait, InteractivePainting, type InteractivePaintingHandle, type TapTarget } from "./art/Painting";
import { DictateButton } from "./DictateButton";
import { StarRating } from "./StarRating";
import { BrushIcon, Ornament, ShareIcon, SpeakerIcon } from "./Icons";

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
}

export function StoryReader({ story, update, readOnly = false, onSaveCopy }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [customIdea, setCustomIdea] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const storyRef = useRef(story);
  storyRef.current = story;
  const started = useRef(false);
  const paintingRef = useRef<InteractivePaintingHandle>(null);

  const { mine: myRating, agg: ratingAgg, vote: voteRating } = useRating(
    story.id,
    { ratingSum: story.ratingSum ?? 0, ratingCount: story.ratingCount ?? 0 },
    story.rating,
    readOnly ? undefined : (r) => update?.((cur) => ({ ...cur, rating: r })),
  );

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
          ? { kind: "start", age: s.age, theme: s.theme, hero: s.hero }
          : {
              kind: "continue",
              story: { age: s.age, theme: s.theme, world: s.world, title: s.title, hero: s.hero, cast: s.cast, segments: s.segments.map((g) => ({ ...g, pages: g.pages.map((p) => ({ ...p, svg: null })) })) },
            };
      try {
        const res = await fetch("/api/story", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as SegmentResponse & { error?: string };
        if (!res.ok || !data.segment) throw new Error(data.error || "The story got stuck. Let's try again!");
        update?.((cur) => ({
          ...cur,
          title: cur.title || data.title || `${cur.hero.name}'s Story`,
          world: cur.world || data.world || "",
          cast: [...cur.cast, ...data.newCharacters],
          segments: [...cur.segments, data.segment],
          status: data.ending ? "complete" : "in-progress",
          demo: cur.demo || data.demo,
        }));
      } catch (e) {
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

  // When a new segment lands, turn to its first page.
  const segCount = story.segments.length;
  const prevSegCount = useRef(segCount);
  useEffect(() => {
    if (segCount > prevSegCount.current) {
      const firstNew = views.findIndex((v) => v.kind === "page" && v.seg === segCount - 1);
      if (firstNew >= 0) setIndex(firstNew);
    }
    prevSegCount.current = segCount;
  }, [segCount, views]);

  useEffect(() => {
    if (busy) {
      setIndex(views.length - 1);
      const t = window.setInterval(() => setLoadingLine((n) => (n + 1) % LOADING_LINES.length), 2600);
      return () => window.clearInterval(t);
    }
  }, [busy, views.length]);

  // Once a story is finished and every page is painted, it joins the public story store.
  const publishedRef = useRef(false);
  useEffect(() => {
    if (readOnly || publishedRef.current || story.published || story.status !== "complete") return;
    const pages = allPages(story);
    if (pages.length === 0 || !pages.every((p) => p.svg)) return;
    publishedRef.current = true;
    void publishToGallery(story).then((ok) => {
      if (ok) update?.((cur) => ({ ...cur, published: true }));
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
  // A snapshot of the page being left, so it can flip away on top while the
  // new page (already rendered beneath it) is revealed underneath.
  const [outgoing, setOutgoing] = useState<{ picture: React.ReactNode; words: React.ReactNode; dir: 1 | -1 } | null>(null);
  const currentContentRef = useRef<{ picture: React.ReactNode; words: React.ReactNode }>({ picture: null, words: null });
  const go = useCallback(
    (d: number) => {
      setOutgoing({ ...currentContentRef.current, dir: d > 0 ? 1 : -1 });
      setIndex((i) => Math.max(0, Math.min(lastIndex, i + d)));
    },
    [lastIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index]);

  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  // ---------------------------------------------------------------- read aloud
  const speak = useCallback((text: string) => speakText(text, { rate: 0.92, pitch: 1.1 }), []);

  useEffect(() => {
    if (!readAloud || !view) return;
    if (view.kind === "page") speak([view.page.aside, view.page.text].filter(Boolean).join(" "));
    if (view.kind === "choice") {
      const c = story.segments[view.seg].choice;
      if (c) speak(`${c.prompt} ${c.options.map((o) => o.label).join("? Or ")}?`);
    }
    if (view.kind === "end") speak("The end.");
  }, [readAloud, view, speak, story.segments]);

  useEffect(() => () => cancelSpeech(), []);

  // ---------------------------------------------------------------- share
  /** Make sure the story is live in the public store before handing out its link.
   *  Idempotent (upsert), so it's safe to call even for a story read from the
   *  store itself, or an old pre-store share link that isn't published yet. */
  const ensurePublished = async () => {
    if (story.published) return;
    const ok = await publishToGallery(story);
    if (ok) update?.((cur) => ({ ...cur, published: true }));
  };

  const shareLink = () => storeUrl(story.id, window.location.origin);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied. Paste it anywhere to share.");
    } catch {
      window.prompt("Copy this link to share:", url);
    }
  };

  const copyLink = async () => {
    await ensurePublished();
    await copyToClipboard(shareLink());
  };

  const share = async () => {
    await ensurePublished();
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
    const fallback = !done && (readOnly || failed[key]) ? composePainting(shown.page, castFor(story, shown.page)) : null;
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
            target={tapTarget(shown.page, [story.hero, ...story.cast], story.age)}
          />
        ) : null}
        {!svg && (
          <div className="picture-wait" aria-live="polite">
            <BrushIcon />
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
        <p className="meta">{LOADING_LINES[loadingLine]}</p>
        <div className="quill" aria-hidden>
          <span />
        </div>
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
        <div className="rate">
          <p className="meta">{readOnly ? "Rate this story" : "Did you enjoy it?"}</p>
          <StarRating
            value={myRating}
            onChange={(r) => {
              voteRating(r);
              flash(readOnly ? "Thank you for rating!" : "Thank you. It's saved in your bookshelf.");
            }}
          />
          <p className="meta rating-summary">{formatRating(ratingAgg.ratingSum, ratingAgg.ratingCount)}</p>
        </div>
        <div className="end-actions">
          <button className="btn btn-soft" onClick={() => setIndex(0)}>
            Read it again
          </button>
          <button className="btn btn-soft" onClick={copyLink}>
            Copy link
          </button>
          {readOnly
            ? onSaveCopy && (
                <button className="btn btn-primary" onClick={onSaveCopy}>
                  Keep this story
                </button>
              )
            : (
                <button className="btn btn-primary" onClick={share}>
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
  const canBack = index > 0;
  const canForward = index < lastIndex && !atChoiceUnanswered;
  const position = view?.kind === "page" ? `Page ${view.number} of ${totalPages}` : view?.kind === "choice" ? "Your turn" : view?.kind === "end" ? "The End" : "";

  // Remember what's on the page right now, so the next go() can hand a
  // snapshot of it to the outgoing flip layer.
  currentContentRef.current = { picture, words };

  return (
    <div className={`reader age-${story.age}`}>
      <div className="reader-top">
        <h1 className="reader-title">{story.title || "A new story"}</h1>
        <div className="reader-tools">
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
            <SpeakerIcon on={readAloud} />
          </button>
          {!readOnly && story.status === "complete" && (
            <button className="icon-btn" onClick={share} aria-label="Share story" title="Share">
              <ShareIcon />
            </button>
          )}
        </div>
      </div>

      <div className="book" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="book-art">
          {picture}
          {outgoing && (
            <div className={`flip-leaf flip-leaf-${outgoing.dir > 0 ? "next" : "prev"}`} onAnimationEnd={() => setOutgoing(null)}>
              {outgoing.picture}
            </div>
          )}
        </div>
        <div className="book-text">
          {words}
          {outgoing && (
            <div className={`flip-leaf flip-leaf-${outgoing.dir > 0 ? "next" : "prev"}`} aria-hidden>
              {outgoing.words}
            </div>
          )}
        </div>
      </div>

      <nav className="reader-nav" aria-label="Turn the page">
        <button className="nav-btn" onClick={() => go(-1)} disabled={!canBack} aria-label="Previous page">
          ‹
        </button>
        <span className="position">{position}</span>
        <button className="nav-btn" onClick={() => go(1)} disabled={!canForward} aria-label="Next page">
          ›
        </button>
      </nav>
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
