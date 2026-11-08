"use client";
import { Painting } from "@/components/art/Painting";
import type { GalleryEntry } from "@/lib/types";
import { StarGlyph } from "./Icons";

const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

/** A story on a shelf: just what matters at a glance - the cover with its
 *  rating, the title and the story's keyword. The whole card is one tap
 *  target that opens the story's preview (no buttons on the card itself). */
export function StoryCard({ entry: s, onOpen }: { entry: GalleryEntry; onOpen: () => void }) {
  const title = s.title || "An untitled story";
  return (
    <button type="button" className="book-card story-card" onClick={onOpen} aria-haspopup="dialog" aria-label={`${title} - open preview`}>
      <span className="cover">
        {s.cover ? <Painting svg={s.cover} title={title} /> : null}
        <span className="cover-meta">
          <span className="cover-rating">
            {s.ratingCount ? (
              <>
                <StarGlyph /> {avg(s).toFixed(1)} ({s.ratingCount})
              </>
            ) : (
              "Not yet rated"
            )}
          </span>
        </span>
      </span>
      <span className="body">
        <span className="story-card-title">{title}</span>
        {s.keyword && <span className="keyword-pill">{s.keyword}</span>}
      </span>
    </button>
  );
}
