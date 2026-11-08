"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryEntry } from "@/lib/types";
import { fetchGallery } from "@/lib/gallery-client";
import { shareUrl, shareStory } from "@/lib/share";
import { CharacterPortrait } from "@/components/art/Painting";
import { MapleMark } from "@/components/Icons";
import { StoryCard } from "./StoryCard";
import { StoryPreview, summaryFromEntry } from "./StoryPreview";
import { InlineRating } from "./InlineRating";
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

  // A limited shelf (the homepage) asks the server for just its top N in
  // the chosen order - not every story and cover in the library - and keeps
  // each order it has fetched so switching back is instant. The full
  // library fetches everything once and sorts here.
  const byOrder = useRef<Partial<Record<GallerySort, GalleryEntry[]>>>({});
  useEffect(() => {
    if (!limit && byOrder.current.recent) return;
    const key: GallerySort = limit ? sort : "recent";
    const have = byOrder.current[key];
    if (have) {
      setStories(have);
      return;
    }
    let live = true;
    fetchGallery(limit ? { sort, limit } : {})
      .then((list) => {
        byOrder.current[key] = list;
        if (live) setStories(list);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [limit, sort]);

  const sorted = useMemo(() => {
    if (!stories) return [];
    const list = [...stories].sort((a, b) =>
      sort === "rating" ? avg(b) - avg(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt,
    );
    return limit ? list.slice(0, limit) : list;
  }, [stories, sort, limit]);

  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? stories?.find((e) => e.id === openId) ?? null : null;

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
            <StoryCard key={s.id} entry={s} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}
      {open && (
        <StoryPreview story={summaryFromEntry(open)} onClose={() => setOpenId(null)}>
          <LibraryActions
            entry={open}
            onCopied={() => flash("Link copied. Paste it anywhere to share.")}
            onRated={(agg) => setStories((cur) => cur?.map((e) => (e.id === open.id ? { ...e, ...agg } : e)) ?? cur)}
          />
        </StoryPreview>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

/** A library story's preview actions: read it, share it, or rate it right here. */
function LibraryActions({
  entry,
  onCopied,
  onRated,
}: {
  entry: GalleryEntry;
  onCopied: () => void;
  onRated: (agg: { ratingSum: number; ratingCount: number }) => void;
}) {
  const [rating, setRating] = useState(false);
  const title = entry.title || "An untitled story";
  return (
    <div className="story-preview-actions">
      <Link className="btn btn-primary btn-block" href={`/store/${entry.id}`}>
        <MapleMark />
        Read the story
      </Link>
      <div className="story-preview-row">
        <button type="button" className="btn btn-soft" onClick={() => shareStory(title, shareUrl(entry.id, window.location.origin), onCopied)}>
          Share
        </button>
        <button type="button" className={`btn btn-soft ${rating ? "on" : ""}`} onClick={() => setRating((r) => !r)} aria-expanded={rating}>
          {rating ? "Hide rating" : "Rate"}
        </button>
      </div>
      {rating && <InlineRating storyId={entry.id} initial={{ ratingSum: entry.ratingSum, ratingCount: entry.ratingCount }} onRated={onRated} />}
    </div>
  );
}
