"use client";
import { Painting } from "@/components/art/Painting";
import type { GalleryEntry } from "@/lib/types";
import { ClockIcon, StarGlyph } from "./Icons";
import { ageById } from "@/lib/ages";
import { KeywordPill } from "./KeywordPill";

const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

/** A story on a shelf: just what matters at a glance - the cover with its
 *  rating, the title and the story's keyword. The whole card is one tap
 *  target that opens the story's preview (no buttons on the card itself). */
export function StoryCard({
  entry: s,
  onOpen,
  daily,
}: {
  entry: GalleryEntry;
  onOpen: () => void;
  /** It's the library's story of the day: a ribbon and a few twinkles. */
  daily?: boolean;
}) {
  const title = s.title || "An untitled story";
  const minutes = s.minutes || ageById(s.age).recommendedMinutes;
  return (
    <button
      type="button"
      className={`book-card story-card${daily ? " story-of-day" : ""}`}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${title} - ${daily ? "story of the day, " : ""}open preview`}
    >
      <span className="cover">
        {s.cover ? <Painting svg={s.cover} title={title} /> : null}
        {daily && (
          <>
            <span className="daily-ribbon">
              <StarGlyph /> Story of the day
            </span>
            <span className="daily-twinkles" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </>
        )}
        <span className="cover-time" aria-label={`About ${minutes} minutes to read`}>
          <ClockIcon /> {minutes} min
        </span>
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
        <KeywordPill keyword={s.keyword} />
        <span className="story-card-title">{title}</span>
      </span>
    </button>
  );
}
