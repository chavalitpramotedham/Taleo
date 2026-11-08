"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GalleryEntry } from "@/lib/types";
import { fetchGallery } from "@/lib/gallery-client";
import { shareUrl, shareStory } from "@/lib/share";
import { Painting, CharacterPortrait } from "@/components/art/Painting";
import { Ornament, StarGlyph, MapleMark } from "@/components/Icons";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { PageLoading } from "./PageLoading";

export type GallerySort = "recent" | "rating";

const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

/** Favourites / Newest pill toggle. */
export function SortPills({ sort, onChange }: { sort: GallerySort; onChange: (s: GallerySort) => void }) {
  return (
    <div className="filter-row" role="tablist">
      <button role="tab" aria-selected={sort === "rating"} className={`chip ${sort === "rating" ? "on" : ""}`} onClick={() => onChange("rating")}>
        Favourites
      </button>
      <button role="tab" aria-selected={sort === "recent"} className={`chip ${sort === "recent" ? "on" : ""}`} onClick={() => onChange("recent")}>
        Newest
      </button>
    </div>
  );
}

/** The public story store as a shelf of cards, with its own Favourites /
 *  Newest toggle. `limit` shows just the top few (home page). */
export function GalleryShelf({
  limit,
  heading,
  headClass,
}: {
  limit?: number;
  /** Shown above the shelf, with the sort pills underneath. */
  heading: React.ReactNode;
  headClass: string;
}) {
  const [stories, setStories] = useState<GalleryEntry[] | null>(null);
  const [sort, setSort] = useState<GallerySort>("rating");
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchGallery()
      .then(setStories)
      .catch(() => setError(true));
  }, []);

  const sorted = useMemo(() => {
    if (!stories) return [];
    const list = [...stories].sort((a, b) =>
      sort === "rating" ? avg(b) - avg(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt,
    );
    return limit ? list.slice(0, limit) : list;
  }, [stories, sort, limit]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const pills = stories && stories.length > 1 ? <SortPills sort={sort} onChange={setSort} /> : null;

  return (
    <>
      <header className={headClass}>
        {heading}
        {pills}
      </header>
      {stories === null && !error ? (
        <PageLoading label="Fetching stories…" compact />
      ) : error ? (
        <div className="empty">
          <h2>The library couldn&apos;t open just now</h2>
          <p className="meta">Please try again in a moment.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty">
          <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
          <h2>The library is empty, for now</h2>
          <p className="meta">Finished stories appear here for anyone to read.</p>
          <Link className="btn btn-primary" href="/create">
            <MapleMark />
            Begin the first story
          </Link>
        </div>
      ) : (
        <div className="shelf">
          {sorted.map((s) => (
            <StoreCard key={s.id} entry={s} onCopied={() => flash("Link copied. Paste it anywhere to share.")} />
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function StoreCard({ entry: s, onCopied }: { entry: GalleryEntry; onCopied: () => void }) {
  const share = () => shareStory(s.title || "An untitled story", shareUrl(s.id, window.location.origin), onCopied);

  return (
    <article className="book-card">
      <Link href={`/store/${s.id}`} className="cover" aria-label={`Read ${s.title}`}>
        {s.cover ? <Painting svg={s.cover} title={s.title} /> : null}
        <div className="cover-meta">
          <span className="cover-rating">
            {s.ratingCount ? (
              <>
                <StarGlyph /> {avg(s).toFixed(1)} ({s.ratingCount})
              </>
            ) : (
              "Not yet rated"
            )}
          </span>
        </div>
      </Link>
      <div className="body">
        <h3>{s.title || "An untitled story"}</h3>
        <Ornament className="ornament small" />
        <p className="meta byline">
          by @{s.authorUsername || "taleo"} · {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </p>
        <div className="card-actions">
          <Link className="btn btn-primary btn-sm" href={`/store/${s.id}`}>
            Read
          </Link>
          <button className="btn btn-soft btn-sm" onClick={share}>
            Share
          </button>
        </div>
      </div>
    </article>
  );
}
