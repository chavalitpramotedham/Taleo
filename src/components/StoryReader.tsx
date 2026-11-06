"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Page, SegmentResponse, Story } from "@/lib/types";
import { ageById } from "@/lib/ages";
import { castMap } from "@/lib/story-utils";
import { shareUrl } from "@/lib/share";
import { Scene } from "./art/Scene";
import { CharacterAvatar } from "./art/CharacterArt";
import { DictateButton } from "./DictateButton";
import { StarRating } from "./StarRating";

type View =
  | { kind: "page"; page: Page; seg: number; n: number }
  | { kind: "choice"; seg: number }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "end" };

const LOADING_LINES = [
  "Mixing the watercolours…",
  "Sharpening the crayons…",
  "Asking the characters what happens next…",
  "Painting fluffy clouds…",
  "Finding the perfect words…",
  "Adding a sprinkle of giggles…",
];

interface Props {
  story: Story;
  onChange?: (s: Story) => void;
  readOnly?: boolean;
  onSaveCopy?: () => void;
}

export function StoryReader({ story, onChange, readOnly = false, onSaveCopy }: Props) {
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

  const cast = useMemo(() => castMap(story), [story]);
  const age = ageById(story.age);

  const views: View[] = useMemo(() => {
    const v: View[] = [];
    story.segments.forEach((seg, si) => {
      seg.pages.forEach((page, pi) => v.push({ kind: "page", page, seg: si, n: pi }));
      if (seg.choice) v.push({ kind: "choice", seg: si });
    });
    if (busy) v.push({ kind: "loading" });
    else if (error) v.push({ kind: "error" });
    else if (story.status === "complete") v.push({ kind: "end" });
    return v;
  }, [story, busy, error]);

  const view = views[Math.min(index, views.length - 1)];
  const lastIndex = views.length - 1;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  // ---------------------------------------------------------------- generation
  const generate = useCallback(
    async (s: Story) => {
      setBusy(true);
      setError(null);
      const body =
        s.segments.length === 0
          ? { kind: "start", age: s.age, theme: s.theme, hero: s.hero }
          : {
              kind: "continue",
              story: {
                age: s.age,
                theme: s.theme,
                title: s.title,
                hero: s.hero,
                cast: s.cast,
                customProps: s.customProps,
                segments: s.segments,
              },
            };
      try {
        const res = await fetch("/api/story", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as SegmentResponse & { error?: string };
        if (!res.ok || !data.segment) throw new Error(data.error || "The story got stuck. Let's try again!");
        const knownProps = new Set(s.customProps.map((p) => p.key));
        const next: Story = {
          ...s,
          title: s.title || data.title || `${s.hero.name}'s Story`,
          cast: [...s.cast, ...data.newCharacters],
          customProps: [...s.customProps, ...data.newProps.filter((p) => !knownProps.has(p.key))],
          segments: [...s.segments, data.segment],
          status: data.ending ? "complete" : "in-progress",
          demo: s.demo || data.demo,
        };
        onChange?.(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (!readOnly && story.segments.length === 0 && !started.current) {
      started.current = true;
      void generate(story);
    }
  }, [story, readOnly, generate]);

  // When a new segment lands, jump to its first page.
  const segCount = story.segments.length;
  const prevSegCount = useRef(segCount);
  useEffect(() => {
    if (segCount > prevSegCount.current) {
      const firstNew = views.findIndex((v) => v.kind === "page" && v.seg === segCount - 1);
      if (firstNew >= 0) setIndex(firstNew);
    }
    prevSegCount.current = segCount;
  }, [segCount, views]);

  // Keep the loading view visible while generating.
  useEffect(() => {
    if (busy) {
      setIndex(views.length - 1);
      const t = window.setInterval(() => setLoadingLine((n) => (n + 1) % LOADING_LINES.length), 2600);
      return () => window.clearInterval(t);
    }
  }, [busy, views.length]);

  const choose = (text: string, custom: boolean) => {
    const t = text.trim();
    if (!t || busy) return;
    const segs = story.segments.map((s, i) => (i === story.segments.length - 1 ? { ...s, chosen: { text: t, custom } } : s));
    const next = { ...story, segments: segs };
    onChange?.(next);
    setCustomIdea("");
    void generate(next);
  };

  // ---------------------------------------------------------------- navigation
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(lastIndex, i + d))), [lastIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  // ---------------------------------------------------------------- read aloud
  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.88;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (!readAloud || !view) return;
    if (view.kind === "page") speak([view.page.aside, view.page.text].filter(Boolean).join(" "));
    if (view.kind === "choice") {
      const c = story.segments[view.seg].choice;
      if (c) speak(`${c.prompt} ${c.options.map((o) => o.label).join("? Or ")}?`);
    }
    if (view.kind === "end") speak("The end!");
  }, [readAloud, view, speak, story.segments]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // ---------------------------------------------------------------- share
  const share = async () => {
    const url = shareUrl(story, window.location.origin);
    const data = { title: story.title, text: `A Taleo story: “${story.title}”`, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied! Paste it to share 💌");
    } catch {
      window.prompt("Copy this link to share:", url);
    }
  };

  // ---------------------------------------------------------------- render
  const lastPage = [...views.slice(0, index + 1)].reverse().find((v): v is Extract<View, { kind: "page" }> => v.kind === "page");
  const scenePage = view?.kind === "page" ? view.page : lastPage?.page ?? story.segments[0]?.pages[0];

  let text: React.ReactNode = null;
  if (!view || view.kind === "loading") {
    text = (
      <div className="loading" aria-live="polite">
        <CharacterAvatar def={story.hero} pose="dance" expression="excited" animate />
        <div className="l-title">{story.segments.length === 0 ? "Writing your story…" : "What happens next?"}</div>
        <div className="meta">{LOADING_LINES[loadingLine]}</div>
        <div className="paintbrush" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  } else if (view.kind === "error") {
    text = (
      <div className="choice-wrap">
        <p className="choice-prompt">Oops! The pages got stuck together.</p>
        <p className="meta">{error}</p>
        <div>
          <button className="btn btn-primary" onClick={() => generate(storyRef.current)}>
            Try again
          </button>
        </div>
      </div>
    );
  } else if (view.kind === "page") {
    text = (
      <div key={`${view.seg}-${view.n}`} className="page-anim" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {view.page.aside && <div className="aside">{view.page.aside}</div>}
        <p className="story-text">{view.page.text}</p>
      </div>
    );
  } else if (view.kind === "choice") {
    const seg = story.segments[view.seg];
    const c = seg.choice!;
    text = (
      <div className="choice-wrap page-anim">
        <p className="choice-prompt">{c.prompt}</p>
        {seg.chosen ? (
          <>
            <div className="chosen-note">
              {seg.chosen.custom ? "💡 Your idea: " : "✅ You chose: "}
              {seg.chosen.text}
            </div>
            {index < lastIndex && (
              <div>
                <button className="btn btn-soft btn-sm" onClick={() => go(1)}>
                  See what happened →
                </button>
              </div>
            )}
          </>
        ) : readOnly ? (
          <div className="meta">This story is still being written.</div>
        ) : (
          <>
            <div className="options">
              {c.options.map((o) => (
                <button key={o.label} className="option" disabled={busy} onClick={() => choose(o.label, false)}>
                  <span className="o-emoji">{o.emoji}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
            <div className="field-row">
              <input
                className="input"
                value={customIdea}
                maxLength={160}
                placeholder="Or your own idea…"
                onChange={(e) => setCustomIdea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && choose(customIdea, true)}
                aria-label="Your own idea for what happens next"
              />
              <DictateButton onText={setCustomIdea} label="Say your idea" />
              <button className="btn btn-primary" disabled={!customIdea.trim() || busy} onClick={() => choose(customIdea, true)}>
                Go!
              </button>
            </div>
          </>
        )}
      </div>
    );
  } else if (view.kind === "end") {
    text = (
      <div className="the-end page-anim">
        <h2>The End</h2>
        {!readOnly && (
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>
              How did you like it?
            </div>
            <StarRating
              value={story.rating}
              onChange={(r) => {
                onChange?.({ ...story, rating: r });
                flash(r >= 4 ? "Yay! Saved to your stories ⭐" : "Thanks! Saved to your stories");
              }}
            />
          </div>
        )}
        <div className="end-actions">
          <button className="btn btn-soft" onClick={() => setIndex(0)}>
            📖 Read again
          </button>
          {readOnly ? (
            onSaveCopy && (
              <button className="btn btn-primary" onClick={onSaveCopy}>
                💾 Save to my stories
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={share}>
              💌 Share
            </button>
          )}
          <Link className="btn btn-soft" href="/create">
            ✨ New story
          </Link>
          {!readOnly && (
            <Link className="btn btn-ghost" href="/library">
              My stories
            </Link>
          )}
        </div>
        {story.demo && <span className="demo-note">Demo story — add an Anthropic API key for AI-written adventures.</span>}
      </div>
    );
  }

  const canBack = index > 0;
  const atChoiceUnanswered = view?.kind === "choice" && !story.segments[view.seg].chosen;
  const canForward = index < lastIndex && !atChoiceUnanswered;

  return (
    <div className={`reader age-${story.age}`}>
      <div className="reader-top">
        <h1 className="reader-title">{story.title || "A new story"}</h1>
        <div className="reader-tools">
          <button
            className={`btn btn-soft icon-btn ${readAloud ? "on" : ""}`}
            onClick={() => {
              if (readAloud && typeof window !== "undefined") window.speechSynthesis?.cancel();
              setReadAloud((r) => !r);
            }}
            aria-pressed={readAloud}
            aria-label={readAloud ? "Stop reading aloud" : "Read aloud"}
            title={readAloud ? "Stop reading aloud" : "Read to me"}
            style={readAloud ? { background: "var(--pink-soft)", borderColor: "var(--pink)" } : undefined}
          >
            {readAloud ? "🔊" : "🔈"}
          </button>
          {!readOnly && story.status === "complete" && (
            <button className="btn btn-soft icon-btn" onClick={share} aria-label="Share story" title="Share">
              💌
            </button>
          )}
        </div>
      </div>

      <div className="book" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="book-art">
          {scenePage ? (
            <Scene page={scenePage} cast={cast} customProps={story.customProps} title={scenePage.text} />
          ) : (
            <Scene
              page={{ text: "", sound: null, aside: null, setting: "meadow", time: "day", weather: "clear", characters: [{ id: "hero", x: 50, expression: "excited", pose: "jump", size: "large", flip: false }], props: [{ kind: "sun", x: 82, y: 30, size: "medium" }, { kind: "flowers", x: 18, y: 92, size: "medium" }, { kind: "cloud", x: 25, y: 24, size: "small" }] }}
              cast={cast}
            />
          )}
        </div>
        <div className="book-text">{text}</div>
      </div>

      <div className="reader-nav">
        <button className="nav-btn back" onClick={() => go(-1)} disabled={!canBack} aria-label="Previous page">
          ←
        </button>
        <div className="dots" role="tablist" aria-label="Pages">
          {views.map((v, i) => (
            <button
              key={i}
              className={`dot ${i === index ? "on" : ""} ${v.kind === "choice" ? "choice" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={v.kind === "page" ? `Page ${i + 1}` : v.kind}
              aria-current={i === index}
            />
          ))}
        </div>
        <button className="nav-btn" onClick={() => go(1)} disabled={!canForward} aria-label="Next page">
          →
        </button>
      </div>
      {age && toast && <div className="toast">{toast}</div>}
    </div>
  );
}
