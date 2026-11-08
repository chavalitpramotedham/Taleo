"use client";
import { useEffect } from "react";
import { Painting } from "@/components/art/Painting";
import { ageById } from "@/lib/ages";
import type { GalleryEntry } from "@/lib/types";
import { Ornament, StarGlyph } from "./Icons";
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
        {story.cover && (
          <div className="story-preview-cover">
            <Painting svg={story.cover} title={story.title} />
          </div>
        )}
        <div className="story-preview-body">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {story.keyword && <KeywordPill keyword={story.keyword} />}
          <h2 id="story-preview-title">{story.title}</h2>
          <p className="meta story-preview-by">by @{story.author}</p>
          <Ornament className="ornament small" />
          <ul className="story-preview-facts">
            {story.starring.length > 0 && (
              <li>
                <span>Starring</span>
                {joinNames(story.starring)}
              </li>
            )}
            <li>
              <span>For ages</span>
              {story.ageLabel}
            </li>
            <li>
              <span>Reading time</span>
              About {story.minutes} min{story.pages ? ` · ${story.pages} pages` : ""}
            </li>
            <li>
              <span>Rating</span>
              {story.ratingAvg != null ? (
                <span className="story-preview-rating">
                  <StarGlyph /> {story.ratingAvg.toFixed(1)} ({story.ratingCount})
                </span>
              ) : (
                "Not yet rated"
              )}
            </li>
          </ul>
          {children}
        </div>
      </div>
    </div>
  );
}
