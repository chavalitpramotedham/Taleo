"use client";
import { QuotaNote } from "./QuotaNote";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryEntry } from "@/lib/types";
import { STORY_DELETED_EVENT, fetchGalleryShelf } from "@/lib/gallery-client";
import { shareUrl, shareStory } from "@/lib/share";
import { CharacterPortrait } from "@/components/art/Painting";
import { MapleMark } from "@/components/Icons";
import { StoryCard } from "./StoryCard";
import { PreviewButtons, SaveStoryButton, StoryPreview, stepper, summaryFromEntry } from "./StoryPreview";
import { CategoryFilter, categoriesOf, matchesCategory } from "./CategoryFilter";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { ShelfSkeleton } from "./ShelfSkeleton";
import { Segmented } from "./Segmented";

export type GallerySort = "recent" | "rating";

const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

const SORTS = [
  { key: "rating", label: "Favourites" },
  { key: "recent", label: "Newest" },
] as const;

/** Favourites / Newest: two options in one pill. */
export function SortPills({ sort, onChange, children }: { sort: GallerySort; onChange: (s: GallerySort) => void; children?: React.ReactNode }) {
  return (
    <div className="filter-row">
      <Segmented options={SORTS} value={sort} onChange={onChange} label="Sort by" />
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
  // A story deleted from its preview leaves the shelf at once.
  useEffect(() => {
    const drop = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      setStories((list) => (list ? list.filter((s) => s.id !== id) : list));
      setOpenId(null);
    };
    window.addEventListener(STORY_DELETED_EVENT, drop);
    return () => window.removeEventListener(STORY_DELETED_EVENT, drop);
  }, []);

  // A limited shelf (the homepage) asks the server for just its top N in
  // the chosen order - not every story and cover in the library - and keeps
  // each order it has fetched so switching back is instant. The full
  // library fetches everything once and sorts here.
  const byOrder = useRef<Record<string, GalleryEntry[]>>({});
  const [homeCategories, setHomeCategories] = useState<string[]>([]);
  // The library's story of the day leads the shelf, whatever the order
  // (not on one author's own bookshelf page).
  const [daily, setDaily] = useState<GalleryEntry | null>(null);
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
    fetchGalleryShelf(limit ? { sort, limit, category, daily: !author } : { daily: !author })
      .then(({ stories: all, categories: cats, daily: today }) => {
        const list = author ? all.filter((e) => e.authorUsername?.toLowerCase() === author.toLowerCase()) : all;
        byOrder.current[key] = list;
        if (live) {
          setStories(list);
          if (today) setDaily(today);
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
    const shown = limit ? list : list.filter((e) => matchesCategory(e, category));
    const lead = daily && matchesCategory(daily, category) && (limit || list.some((e) => e.id === daily.id)) ? daily : null;
    const all = lead ? [lead, ...shown.filter((e) => e.id !== lead.id)] : shown;
    return limit ? all.slice(0, limit) : all;
  }, [stories, sort, limit, category, daily]);

  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? sorted.find((e) => e.id === openId) ?? null : null;

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
          <h2>The Public Library couldn&apos;t open just now</h2>
          <p className="meta">Please try again in a moment.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty">
          <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
          <h2>{author ? "No stories here yet" : "The Public Library is empty, for now"}</h2>
          <p className="meta">{author ? `Stories @${author} shares will appear here.` : "Finished stories appear here for anyone to read."}</p>
          <Link className="btn btn-primary" href="/create">
            <MapleMark />
            Begin the first story
          </Link>
          <QuotaNote />
        </div>
      ) : (
        <div className="shelf">
          {sorted.map((s) => (
            <StoryCard key={s.id} entry={s} daily={s.id === daily?.id} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}
      {open && (
        <StoryPreview story={summaryFromEntry(open)} onClose={() => setOpenId(null)} {...stepper(sorted, open.id, setOpenId)}>
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
export function LibraryActions({
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
        label="Read"
        onShare={() => shareStory(title, shareUrl(entry.id, window.location.origin), onCopied)}
        extra={<SaveStoryButton id={entry.id} author={entry.authorUsername} />}
      />
    </div>
  );
}
