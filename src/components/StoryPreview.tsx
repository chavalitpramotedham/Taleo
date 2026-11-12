"use client";
import Link, { useLinkStatus } from "next/link";
import { shortDate } from "@/lib/dates";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { deleteGalleryStory } from "@/lib/gallery-client";
import { setStorySaved, useSaved } from "@/lib/saved-client";
import { useToast } from "./Toast";
import { Painting } from "@/components/art/Painting";
import { ageById, timeRange, timeWords } from "@/lib/ages";
import type { GalleryEntry } from "@/lib/types";
import {
  BookmarkIcon,
  ClockIcon,
  LeafLoader,
  MapleMark,
  ShareIcon,
  StarGlyph, CogIcon } from "./Icons";
import { KeywordPill } from "./KeywordPill";

/** Everything a story preview shows - small enough to come from a library
 *  entry, without loading the whole book. */
export interface StorySummary {
  id: string;
  title: string;
  cover: string | null;
  author: string;
  keyword?: string;
  starring: string[];
  ageLabel: string;
  minutes: number;
  pages?: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** When it was made (ms). */
  createdAt?: number;
}

export function summaryFromEntry(e: GalleryEntry): StorySummary {
  const age = ageById(e.age);
  return {
    id: e.id,
    title: e.title || "An untitled story",
    cover: e.cover,
    author: e.authorUsername || "taleo",
    createdAt: e.createdAt,
    keyword: e.keyword,
    starring: e.starring?.length ? e.starring : [e.heroName].filter(Boolean),
    ageLabel: age.label,
    minutes: e.minutes || age.recommendedMinutes,
    pages: e.pages,
    ratingAvg: e.ratingCount ? e.ratingSum / e.ratingCount : null,
    ratingCount: e.ratingCount,
  };
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

/** A story's preview, as a popup: the cover, title, keyword and key
 *  details, with whatever actions the caller puts underneath (read, share,
 *  rate…). Used for library and bookshelf cards and for shared links. */
export function StoryPreview({
  story,
  eyebrow,
  onClose,
  onPrev,
  onNext,
  children,
}: {
  story: StorySummary;
  eyebrow?: string;
  onClose: () => void;
  /** Step to the previous / next story in the list it was opened from
   *  (omitted at either end of the list). */
  onPrev?: () => void;
  onNext?: () => void;
  children: React.ReactNode;
}) {
  // The popup appears the moment the card is tapped; the cover painting
  // (the slow part: its watercolour is drawn fresh at this size) follows a
  // frame later, with the falling leaves holding its place until then.
  const [showArt, setShowArt] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(
      () => (b = requestAnimationFrame(() => setShowArt(true))),
    );
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
    // (again for each story stepped to)
  }, [story.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // A sideways swipe on the preview steps through the list too.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const dx = e.changedTouches[0].clientX - from.x;
    const dy = e.changedTouches[0].clientY - from.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onNext?.();
    else onPrev?.();
  };
  const stepping = Boolean(onPrev || onNext);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  // (a different story's ratings start closed)
  useEffect(() => setRatingsOpen(false), [story.id]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="story-preview-wrap" onClick={(e) => e.stopPropagation()}>
      {/* Previous / next story in the same list - like the steps' arrows */}
      {stepping && (
        <>
          <button type="button" className="preview-step preview-step-prev" onClick={onPrev} disabled={!onPrev} aria-label="Previous story">
            ‹
          </button>
          <button type="button" className="preview-step preview-step-next" onClick={onNext} disabled={!onNext} aria-label="Next story">
            ›
          </button>
        </>
      )}
      <div
        className="modal-panel story-preview"
        onTouchStart={stepping ? onTouchStart : undefined}
        onTouchEnd={stepping ? onTouchEnd : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-preview-title"
      >
        <button
          type="button"
          className="icon-btn story-preview-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="story-preview-cover">
          {story.cover && showArt ? (
            <Painting
              svg={story.cover}
              title={story.title}
              className="story-preview-art"
            />
          ) : (
            <span className="story-preview-wait" aria-hidden>
              <LeafLoader size={40} />
            </span>
          )}
          <span
            className="cover-time"
            aria-label={`About ${timeWords(story.minutes)} minutes to read${story.pages ? `, ${story.pages} ${story.pages === 1 ? "page" : "pages"}` : ""}`}
          >
            <ClockIcon /> {timeRange(story.minutes)} min
            {story.pages
              ? ` · ${story.pages} ${story.pages === 1 ? "page" : "pages"}`
              : ""}
          </span>
          <span className="cover-meta">
            {/* The one place a preview shows ratings: tap for the details. */}
            {story.ratingAvg != null ? (
              <button type="button" className="cover-rating cover-rating-btn" onClick={() => setRatingsOpen(true)} aria-label={`Rated ${story.ratingAvg.toFixed(1)} from ${story.ratingCount} - see the ratings`}>
                <StarGlyph /> {story.ratingAvg.toFixed(1)} ({story.ratingCount})
                <span className="cover-rating-more" aria-hidden>
                  ›
                </span>
              </button>
            ) : (
              <span className="cover-rating">Not yet rated</span>
            )}
          </span>
        </div>
        <div className="story-preview-body">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {story.keyword && <KeywordPill keyword={story.keyword} />}
          <h2 id="story-preview-title">{story.title}</h2>
          <p className="story-preview-meta">
            {story.starring.length > 0 && (
              <>
                Starring <b>{joinNames(story.starring)}</b>
                <span className="dot" aria-hidden>
                  ·
                </span>
              </>
            )}
            Ages <b>{story.ageLabel}</b>
          </p>
          <p className="meta story-preview-by">
            {/* when it was made, then who by (and, for its own author, a
                small gear to manage it) */}
            {shortDate(story.createdAt) && (
              <>
                <span suppressHydrationWarning>{shortDate(story.createdAt)}</span>
                <span className="dot" aria-hidden>
                  ·
                </span>
              </>
            )}
            by{" "}
            <Link
              className="story-preview-author"
              href={`/author/${encodeURIComponent(story.author)}`}
            >
              @{story.author}
            </Link>
            <ManageStory story={story} onDeleted={onClose} />
          </p>
          {children}
        </div>
        {ratingsOpen && <RatingsDetail story={story} onClose={() => setRatingsOpen(false)} />}
      </div>
      </div>
    </div>
  );
}

type RatingsData = { ratings: { userId: string; username: string; rating: number; comment: string | null; createdAt: number }[] | null; counts: number[]; mine: { rating: number; comment: string | null } | null };

/** A story's ratings, over its preview: the average, how many gave each
 *  number of stars, your own rating, and - for the story's author (and the
 *  admin) - who rated it and what they said. */
function RatingsDetail({ story, onClose }: { story: StorySummary; onClose: () => void }) {
  const [data, setData] = useState<RatingsData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/gallery/${encodeURIComponent(story.id)}/ratings`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: RatingsData) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [story.id]);
  const total = data ? data.counts.reduce((a, b) => a + b, 0) : story.ratingCount;
  return (
    <div className="ratings-detail" role="dialog" aria-label="Ratings">
      <div className="ratings-detail-head">
        <h3>Ratings</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to the story">
          ✕
        </button>
      </div>
      <p className="ratings-detail-avg">
        <b>{story.ratingAvg?.toFixed(1)}</b>
        <span className="ratings-detail-stars" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <StarGlyph key={n} />
          )).map((s, i) => (
            <span key={i} className={i < Math.round(story.ratingAvg ?? 0) ? "on" : ""}>
              {s}
            </span>
          ))}
        </span>
        <span className="meta">
          {story.ratingCount} {story.ratingCount === 1 ? "rating" : "ratings"}
        </span>
      </p>
      {data ? (
        <>
          <ul className="ratings-bars">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = data.counts[n - 1] ?? 0;
              return (
                <li key={n}>
                  <span>{n}</span>
                  <span className="ratings-bar">
                    <span style={{ transform: `scaleX(${total ? c / total : 0})` }} />
                  </span>
                  <span className="ratings-bar-count">{c}</span>
                </li>
              );
            })}
          </ul>
          {data.mine && (
            <p className="ratings-mine">
              You gave it <b>{data.mine.rating}</b> {data.mine.rating === 1 ? "star" : "stars"}
              {data.mine.comment ? <> - &ldquo;{data.mine.comment}&rdquo;</> : null}
            </p>
          )}
          {data.ratings && data.ratings.length > 0 && (
            <>
              <h4 className="ratings-who">Who rated it</h4>
              <ul className="ratings-list">
                {[...data.ratings].sort((a, b) => b.createdAt - a.createdAt).map((r) => (
                  <li key={r.userId}>
                    <span className="ratings-list-head">
                      <b>@{r.username}</b>
                      <span>{"★".repeat(r.rating)}</span>
                    </span>
                    {r.comment && <span className="ratings-list-comment">&ldquo;{r.comment}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : failed ? (
        <p className="meta">The ratings couldn&apos;t load just now.</p>
      ) : (
        <div className="ratings-wait">
          <LeafLoader size={28} />
        </div>
      )}
    </div>
  );
}

/** Previous / next handlers for a preview opened from a list: steps only
 *  within that list (as currently sorted and filtered), none at its ends. */
export function stepper(list: { id: string }[], id: string, open: (id: string) => void) {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return {};
  return {
    onPrev: i > 0 ? () => open(list[i - 1].id) : undefined,
    onNext: i < list.length - 1 ? () => open(list[i + 1].id) : undefined,
  };
}

/** The preview's buttons: the main "read" button, left, taking the room,
 *  with a small round share button beside it. */
export function PreviewButtons({
  href,
  label,
  onShare,
  onRead,
  extra,
}: {
  href: string;
  label: string;
  onShare: () => void;
  onRead?: () => void;
  /** another small round button beside Share (e.g. Save) */
  extra?: React.ReactNode;
}) {
  return (
    <div className="story-preview-buttons">
      {/* (the whole story page is fetched as soon as the preview opens - the
          tap that opens it is a good sign it's about to be read) */}
      <Link className="btn btn-primary" href={href} onClick={onRead} prefetch>
        <ReadLabel label={label} />
      </Link>
      {extra}
      <button
        type="button"
        className="icon-btn story-preview-share"
        onClick={onShare}
        aria-label="Share story"
        title="Share"
      >
        <ShareIcon />
      </button>
    </div>
  );
}

/** Save someone else's library story to your bookshelf (or take it off) -
 *  for signed-in readers, never on your own stories. */
export function SaveStoryButton({
  id,
  author,
  className = "story-preview-share",
  fallback = null,
}: {
  id: string;
  author?: string;
  /** Where it sits: beside a preview's read button (the default), or as
   *  one of the round icons at a story's end. */
  className?: string;
  /** Shown instead where there is nothing to save (your own story, or
   *  signed out). */
  fallback?: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const me = session?.user?.username?.toLowerCase();
  const allowed = status === "authenticated" && (!author || author.toLowerCase() !== me);
  const userId = allowed ? session?.user?.id : null;
  const saved = useSaved(id, userId);
  const toast = useToast();
  if (!allowed || !userId) return fallback;
  const toggle = async () => {
    const next = !saved;
    const ok = await setStorySaved(userId, id, next);
    toast(ok ? (next ? "Added to your bookshelf" : "Removed from your bookshelf") : "Couldn't save that. Please try again.", ok ? (next ? "done" : "removed") : "error");
  };
  return (
    <button
      type="button"
      className={`icon-btn ${className} story-preview-save ${saved ? "on" : ""}`}
      onClick={() => void toggle()}
      disabled={saved === null}
      aria-pressed={Boolean(saved)}
      aria-label={saved ? "Saved to your bookshelf - tap to remove" : "Save to my bookshelf"}
      title={saved ? "Saved to your bookshelf" : "Save to my bookshelf"}
    >
      <BookmarkIcon />
    </button>
  );
}

/** The read button's contents: while the story is on its way (after the
 *  tap, before the page arrives), the leaves fall and it says "Opening…",
 *  so a tap always visibly registers. */
function ReadLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <>
      <LeafLoader size={18} />
      Opening…
    </>
  ) : (
    <>
      <MapleMark />
      {label}
    </>
  );
}

/** For the story's own author: a small gear after their name, opening a
 *  small menu (just Delete for now). Deleting asks first, in its own
 *  dialog, then removes the story everywhere. */
function ManageStory({
  story,
  onDeleted,
}: {
  story: StorySummary;
  onDeleted: () => void;
}) {
  const { data: session } = useSession();
  const mine =
    Boolean(session?.user?.username) &&
    session!.user.username!.toLowerCase() === story.author.toLowerCase();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) =>
      !wrap.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  if (!mine) return null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteGalleryStory(story.id);
      setConfirm(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the story.");
      setBusy(false);
    }
  };

  return (
    <>
      <span className="story-manage" ref={wrap}>
        {/* (a small gear beside the name; its tappable area is larger
            than the drawing) */}
        <button
          type="button"
          className="story-manage-gear"
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label="Manage this story"
          title="Manage this story"
        >
          <CogIcon />
        </button>
        {menu && (
          <span className="music-dropdown story-manage-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="music-dropdown-item story-manage-delete"
              onClick={() => {
                setMenu(false);
                setConfirm(true);
              }}
            >
              Delete story
            </button>
          </span>
        )}
      </span>
      {confirm &&
        createPortal(
          // (on the page itself, not inside the italic "by" line it opens from)
          <div
            className="modal-backdrop redraw-backdrop"
            onClick={(e) => (e.stopPropagation(), !busy && setConfirm(false))}
          >
            <div
              className="modal-panel confirm-panel"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-story-delete"
              onClick={(e) => e.stopPropagation()}
            >
              {story.cover && (
                <span className="confirm-cover">
                  <Painting svg={story.cover} title={story.title} />
                </span>
              )}
              <h3 id="confirm-story-delete">
                Delete &ldquo;{story.title}&rdquo;?
              </h3>
              <p className="confirm-warning">
                This can&apos;t be undone. The story will be gone for good -
                from the library, your bookshelf and anyone&apos;s saved links -
                along with its ratings.
              </p>
              <div className="redraw-choices">
                <button
                  type="button"
                  className="btn btn-danger btn-block"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <LeafLoader size={18} /> Deleting…
                    </>
                  ) : (
                    "Yes, delete this story"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-soft btn-block"
                  onClick={() => setConfirm(false)}
                  disabled={busy}
                >
                  Keep it
                </button>
              </div>
              {error && <p className="error">{error}</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
