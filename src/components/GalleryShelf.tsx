"use client";
import { QuotaNote } from "./QuotaNote";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "./Toast";
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
import { forgetStory, recall, remember } from "@/lib/remember";

type Shelf = { stories: GalleryEntry[]; categories: string[]; daily: GalleryEntry | null };

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
  expect,
}: {
  limit?: number;
  /** Only this author's stories (their bookshelf page). */
  author?: string;
  /** Shown above the shelf, with the sort pills underneath. */
  heading: React.ReactNode;
  headClass: string;
  /** How many books the page already knows this shelf will hold (the
   *  server's list at the foot of the page): while the shelf is on its
   *  way, the placeholder keeps room for that many - and for the sort
   *  pills - so a small library doesn't jump up when the books arrive. */
  expect?: number;
}) {
  const [sort, setSort] = useState<GallerySort>("rating");
  // Category filter (the homepage asks the server for the top few of the
  // chosen category; full shelves filter what they have).
  const [category, setCategory] = useState<string | null>(null);
  // What each shelf held when it was last fetched is kept while the tab is
  // open (see lib/remember): coming back to the page shows it at once,
  // and the server is asked again behind it.
  const keyOf = (order: GallerySort, cat: string | null) => `shelf:${limit ?? "all"}:${author ?? ""}:${limit ? `${order}|${cat ?? ""}` : "recent"}`;
  const first = recall<Shelf>(keyOf("rating", null));
  const [stories, setStories] = useState<GalleryEntry[] | null>(first?.stories ?? null);
  const [error, setError] = useState(false);
  const flash = useToast();
  // A story deleted from its preview leaves the shelf at once.
  useEffect(() => {
    const drop = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) forgetStory(id);
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
  const asked = useRef(new Set<string>());
  const [homeCategories, setHomeCategories] = useState<string[]>(limit ? first?.categories ?? [] : []);
  // The library's story of the day leads the shelf, whatever the order
  // (not on one author's own bookshelf page).
  const [daily, setDaily] = useState<GalleryEntry | null>(first?.daily ?? null);
  useEffect(() => {
    // the homepage keeps each order (and category) it has fetched
    const key = keyOf(sort, category);
    const have = recall<Shelf>(key);
    if (have) setStories(have.stories);
    // (asked once each time the page is opened, not on every switch back)
    if (asked.current.has(key)) return;
    let live = true;
    fetchGalleryShelf(limit ? { sort, limit, category, daily: !author } : { daily: !author })
      .then(({ stories: all, categories, daily: today }) => {
        const list = author ? all.filter((e) => e.authorUsername?.toLowerCase() === author.toLowerCase()) : all;
        asked.current.add(key);
        remember<Shelf>(key, { stories: list, categories, daily: today });
        if (live) {
          setError(false);
          setStories(list);
          if (today) setDaily(today);
          if (limit) setHomeCategories(categories);
        }
      })
      .catch(() => live && !have && setError(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const categories = useMemo(() => (limit ? homeCategories : stories ? categoriesOf(stories) : []), [stories, limit, homeCategories]);
  const pills =
    (stories ? stories.length > 1 || category : !error && (expect ?? 0) > 1) ? (
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
        <ShelfSkeleton count={expect === undefined ? limit ?? 6 : Math.min(expect, limit ?? 12)} />
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
          <LibraryActions entry={open} onCopied={() => flash("Link copied")} />
        </StoryPreview>
      )}
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
