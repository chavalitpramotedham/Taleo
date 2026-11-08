"use client";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { Painting } from "@/components/art/Painting";
import { ageById } from "@/lib/ages";
import type { GalleryEntry } from "@/lib/types";
import { ClockIcon, LeafLoader, MapleMark, ShareIcon, StarGlyph } from "./Icons";
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
}

export function summaryFromEntry(e: GalleryEntry): StorySummary {
  const age = ageById(e.age);
  return {
    id: e.id,
    title: e.title || "An untitled story",
    cover: e.cover,
    author: e.authorUsername || "taleo",
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
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

/** A story's preview, as a popup: the cover, title, keyword and key
 *  details, with whatever actions the caller puts underneath (read, share,
 *  rate…). Used for library and bookshelf cards and for shared links. */
export function StoryPreview({
  story,
  eyebrow,
  onClose,
  children,
}: {
  story: StorySummary;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // The popup appears the moment the card is tapped; the cover painting
  // (the slow part: its watercolour is drawn fresh at this size) follows a
  // frame later, with the falling leaves holding its place until then.
  const [showArt, setShowArt] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setShowArt(true))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel story-preview"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-preview-title"
      >
        <button type="button" className="icon-btn story-preview-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="story-preview-cover">
          {story.cover && showArt ? (
            <Painting svg={story.cover} title={story.title} className="story-preview-art" />
          ) : (
            <span className="story-preview-wait" aria-hidden>
              <LeafLoader size={40} />
            </span>
          )}
          <span className="cover-time" aria-label={`About ${story.minutes} minutes to read${story.pages ? `, ${story.pages} pages` : ""}`}>
            <ClockIcon /> {story.minutes} min{story.pages ? ` · ${story.pages} pages` : ""}
          </span>
          <span className="cover-meta">
            <span className="cover-rating">
              {story.ratingAvg != null ? (
                <>
                  <StarGlyph /> {story.ratingAvg.toFixed(1)} ({story.ratingCount})
                </>
              ) : (
                "Not yet rated"
              )}
            </span>
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
            by{" "}
            <Link className="story-preview-author" href={`/author/${encodeURIComponent(story.author)}`}>
              @{story.author}
            </Link>
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The preview's buttons: the main "read" button, left, taking the room,
 *  with a small round share button beside it. */
export function PreviewButtons({ href, label, onShare, onRead }: { href: string; label: string; onShare: () => void; onRead?: () => void }) {
  return (
    <div className="story-preview-buttons">
      <Link className="btn btn-primary" href={href} onClick={onRead}>
        <ReadLabel label={label} />
      </Link>
      <button type="button" className="icon-btn story-preview-share" onClick={onShare} aria-label="Share story" title="Share">
        <ShareIcon />
      </button>
    </div>
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
