"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Painting } from "@/components/art/Painting";
import { MapleMark, Ornament, StarGlyph } from "./Icons";

export interface SharedStorySummary {
  id: string;
  title: string;
  cover: string | null;
  author: string;
  starring: string[];
  ageLabel: string;
  minutes: number;
  pages: number;
  ratingAvg: number | null;
  ratingCount: number;
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

/** The welcome a visitor sees when they arrive from a shared story link:
 *  the homepage, with this popup on top - the story's cover, title and
 *  key details, and a button to start reading. Closing it (or starting to
 *  read) tidies the link out of the address bar so it doesn't reappear. */
export function SharedStoryWelcome({ story }: { story: SharedStorySummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const close = useCallback(() => {
    setOpen(false);
    router.replace("/", { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal-panel shared-welcome"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-welcome-title"
      >
        <button type="button" className="icon-btn shared-welcome-close" onClick={close} aria-label="Close">
          ✕
        </button>
        {story.cover && (
          <div className="shared-welcome-cover">
            <Painting svg={story.cover} title={story.title} />
          </div>
        )}
        <div className="shared-welcome-body">
          <p className="eyebrow">A story shared with you</p>
          <h2 id="shared-welcome-title">{story.title}</h2>
          <p className="meta shared-welcome-by">by @{story.author}</p>
          <Ornament className="ornament small" />
          <ul className="shared-welcome-facts">
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
              About {story.minutes} min · {story.pages} pages
            </li>
            <li>
              <span>Rating</span>
              {story.ratingAvg != null ? (
                <span className="shared-welcome-rating">
                  <StarGlyph /> {story.ratingAvg.toFixed(1)} ({story.ratingCount})
                </span>
              ) : (
                "Not yet rated"
              )}
            </li>
          </ul>
          <Link className="btn btn-primary btn-block" href={`/store/${story.id}`} onClick={() => setOpen(false)}>
            <MapleMark />
            Start reading
          </Link>
          <button type="button" className="btn btn-ghost btn-block" onClick={close}>
            Look around first
          </button>
        </div>
      </div>
    </div>
  );
}
