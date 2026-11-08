"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryEntry } from "@/lib/types";
import { fetchGalleryShelf } from "@/lib/gallery-client";
import { shareUrl, shareStory } from "@/lib/share";
import { CharacterPortrait } from "@/components/art/Painting";
import { MapleMark } from "@/components/Icons";
import { StoryCard } from "./StoryCard";
import { PreviewButtons, StoryPreview, summaryFromEntry } from "./StoryPreview";
import { MyRatingNote } from "./InlineRating";
import { CategoryFilter, categoriesOf, matchesCategory } from "./CategoryFilter";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { ShelfSkeleton } from "./ShelfSkeleton";

export type GallerySort = "recent" | "rating";

const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

/** Favourites / Newest pill toggle. */
export function SortPills({ sort, onChange, children }: { sort: GallerySort; onChange: (s: GallerySort) => void; children?: React.ReactNode }) {
  return (
    <div className="filter-row" role="tablist">
      <button role="tab" aria-selected={sort === "rating"} className={`chip ${sort === "rating" ? "on" : ""}`} onClick={() => onChange("rating")}>
        Favourites
      </button>
      <button role="tab" aria-selected={sort === "recent"} className={`chip ${sort === "recent" ? "on" : ""}`} onClick={() => onChange("recent")}>
        Newest
      </button>
      {children && (
        <>
          <span className="filter-split" aria-hidden />
          {children}
        </>
      )}
    </div>
  );
}

/** The public story store as a shelf of cards, with its own Favourites /
 *  Newest toggle. `limit` shows just the top few (home page). */
export function GalleryShelf({
  limit,
  author,
  heading,
  headClass,
}: {
  limit?: number;
  /** Only this author's stories (their bookshelf page). */
  author?: string;
  /** Shown above the shelf, with the sort pills underneath. */
  heading: React.ReactNode;
  headClass: string;
}) {
  const [stories, setStories] = useState<GalleryEntry[] | null>(null);
  const [sort, setSort] = useState<GallerySort>("rating");
  // Category filter (the homepage asks the server for the top few of the
  // chosen category; full shelves filter what they have).
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // A limited shelf (the homepage) asks the server for just its top N in
  // the chosen order - not every story and cover in the library - and keeps
  // each order it has fetched so switching back is instant. The full
  // library fetches everything once and sorts here.
  const byOrder = useRef<Record<string, GalleryEntry[]>>({});
  const [homeCategories, setHomeCategories] = useState<string[]>([]);
  useEffect(() => {
    if (!limit && byOrder.current.recent) return;
    // the homepage keeps each order (and category) it has fetched
    const key = limit ? `${sort}|${category ?? ""}` : "recent";
    const have = byOrder.current[key];
    if (have) {
      setStories(have);
      return;
    }
    let live = true;
    fetchGalleryShelf(limit ? { sort, limit, category } : {})
      .then(({ stories: all, categories: cats }) => {
        const list = author ? all.filter((e) => e.authorUsername?.toLowerCase() === author.toLowerCase()) : all;
        byOrder.current[key] = list;
        if (live) {
          setStories(list);
          if (limit) setHomeCategories(cats);
        }
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [limit, sort, author, category]);

  const sorted = useMemo(() => {
    if (!stories) return [];
    const list = [...stories].sort((a, b) =>
      sort === "rating" ? avg(b) - avg(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt,
    );
    // (the homepage's few already come narrowed to the category)
    return limit ? list.slice(0, limit) : list.filter((e) => matchesCategory(e, category));
  }, [stories, sort, limit, category]);

  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? stories?.find((e) => e.id === openId) ?? null : null;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const categories = useMemo(() => (limit ? homeCategories : stories ? categoriesOf(stories) : []), [stories, limit, homeCategories]);
  const pills =
    stories && (stories.length > 1 || category) ? (
      <SortPills sort={sort} onChange={setSort}>
        {categories.length > 1 && <CategoryFilter options={categories} value={category} onChange={setCategory} />}
      </SortPills>
    ) : null;

  return (
    <>
      <header className={headClass}>
        {heading}
        {pills}
      </header>
      {stories === null && !error ? (
        <ShelfSkeleton count={limit ?? 6} />
      ) : error ? (
        <div className="empty">
          <h2>The library couldn&apos;t open just now</h2>
          <p className="meta">Please try again in a moment.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty">
          <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
          <h2>{author ? "No stories here yet" : "The library is empty, for now"}</h2>
          <p className="meta">{author ? `Stories @${author} shares will appear here.` : "Finished stories appear here for anyone to read."}</p>
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
          <LibraryActions entry={open} onCopied={() => flash("Link copied. Paste it anywhere to share.")} />
        </StoryPreview>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

/** A library story's preview actions: read it (the main button) with a
 *  small share button beside it, and - only if you've rated it - your
 *  rating underneath. (Rating itself happens at the end of the story.) */
function LibraryActions({
  entry,
  onCopied,
}: {
  entry: GalleryEntry;
  onCopied: () => void;
}) {
  const title = entry.title || "An untitled story";
  return (
    <div className="story-preview-actions">
      <PreviewButtons
        href={`/store/${entry.id}`}
        label="Read the story"
        onShare={() => shareStory(title, shareUrl(entry.id, window.location.origin), onCopied)}
      />
      <MyRatingNote storyId={entry.id} initial={{ ratingSum: entry.ratingSum, ratingCount: entry.ratingCount }} />
    </div>
  );
}
