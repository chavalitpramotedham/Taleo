"use client";
import { useEffect } from "react";
import { Painting } from "@/components/art/Painting";
import { ageById } from "@/lib/ages";
import type { GalleryEntry } from "@/lib/types";
import { ClockIcon, StarGlyph } from "./Icons";
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
          {story.cover && <Painting svg={story.cover} title={story.title} />}
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
          <p className="meta story-preview-by">by @{story.author}</p>
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
          {children}
        </div>
      </div>
    </div>
  );
}
