"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { STORY_DELETED_EVENT } from "@/lib/gallery-client";
import { SAVED_EVENT } from "@/lib/saved-client";
import { LibraryActions } from "@/components/GalleryShelf";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { GalleryEntry } from "@/lib/types";
import { shareUrl, shareStory } from "@/lib/share";
import { CharacterPortrait } from "@/components/art/Painting";
import { MapleMark } from "@/components/Icons";
import { StoryCard } from "@/components/StoryCard";
import { PreviewButtons, StoryPreview, stepper, summaryFromEntry } from "@/components/StoryPreview";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { CategoryFilter, categoriesOf, matchesCategory } from "@/components/CategoryFilter";
import { ShelfSkeleton } from "@/components/ShelfSkeleton";

type Sort = "recent" | "rating";
const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

export default function MyStoriesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stories, setStories] = useState<GalleryEntry[] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [category, setCategory] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in?next=/my-stories");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/gallery/mine")
      .then((r) => r.json())
      .then((d: { stories?: GalleryEntry[] }) => setStories(d.stories ?? []));
    // Stories saved from the library (their own section, only if any).
    fetch("/api/user/saved")
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((d: { stories?: GalleryEntry[] }) => setSaved(d.stories ?? []))
      .catch(() => setSaved([]));
  }, [status]);

  // Unsaving a story (from its preview) takes it off the Saved shelf.
  const [savedList, setSaved] = useState<GalleryEntry[] | null>(null);
  const saved = useMemo(() => savedList ?? [], [savedList]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; saved: boolean }>).detail;
      if (d && !d.saved) setSaved((list) => (list ? list.filter((s) => s.id !== d.id) : list));
    };
    window.addEventListener(SAVED_EVENT, on);
    return () => window.removeEventListener(SAVED_EVENT, on);
  }, []);
  const savedSorted = useMemo(
    () =>
      saved
        .filter((e) => matchesCategory(e, category))
        .sort((a, b) => (sort === "rating" ? avg(b) - avg(a) || 0 : 0)),
    [saved, sort, category],
  );
  const [openSavedId, setOpenSavedId] = useState<string | null>(null);
  const openSaved = openSavedId ? saved.find((e) => e.id === openSavedId) ?? null : null;

  const sorted = useMemo(
    () =>
      stories
        ? [...stories]
            .filter((e) => matchesCategory(e, category))
            .sort((a, b) => (sort === "rating" ? avg(b) - avg(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt))
        : [],
    [stories, sort, category],
  );
  const categories = useMemo(() => categoriesOf([...(stories ?? []), ...saved]), [stories, saved]);

  const [openId, setOpenId] = useState<string | null>(null);
  // A story deleted from its preview leaves the bookshelf at once.
  useEffect(() => {
    const drop = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      setStories((list) => (list ? list.filter((s) => s.id !== id) : list));
      setOpenId(null);
      setToast("Story deleted.");
      window.setTimeout(() => setToast(null), 2400);
    };
    window.addEventListener(STORY_DELETED_EVENT, drop);
    return () => window.removeEventListener(STORY_DELETED_EVENT, drop);
  }, []);
  const open = openId ? stories?.find((e) => e.id === openId) ?? null : null;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  // (both shelves arrive together, so the page never shifts as one lands)
  if (status !== "authenticated" || stories === null || savedList === null)
    return (
      <div className="container">
        <header className="wizard-head">
          <p className="eyebrow">Just yours</p>
          <h1>My bookshelf</h1>
        </header>
        <ShelfSkeleton label="Fetching your bookshelf…" />
      </div>
    );

  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">Just yours</p>
        <h1>My bookshelf</h1>
        {stories.length + saved.length > 1 && (
          <div className="filter-row">
            <button className={`chip ${sort === "recent" ? "on" : ""}`} onClick={() => setSort("recent")}>
              Newest
            </button>
            <button className={`chip ${sort === "rating" ? "on" : ""}`} onClick={() => setSort("rating")}>
              Favourites
            </button>
            {categories.length > 1 && (
              <>
                <span className="filter-split" aria-hidden />
                <CategoryFilter options={categories} value={category} onChange={setCategory} />
              </>
            )}
          </div>
        )}
      </header>

      {saved.length > 0 && <h2 className="shelf-section-title">My originals</h2>}
      {sorted.length === 0 ? (
        <div className="empty">
          <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
          <h2>You haven&apos;t written one yet</h2>
          <p className="meta">Finished stories you create live here.</p>
          <Link className="btn btn-primary" href="/create">
            <MapleMark />
            Begin your first story
          </Link>
        </div>
      ) : (
        <div className="shelf">
          {sorted.map((s) => (
            <StoryCard key={s.id} entry={s} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}
      {savedSorted.length > 0 && (
        <>
          <h2 className="shelf-section-title">Saved from the library</h2>
          <div className="shelf">
            {savedSorted.map((s) => (
              <StoryCard key={s.id} entry={s} onOpen={() => setOpenSavedId(s.id)} />
            ))}
          </div>
        </>
      )}
      {openSaved && (
        <StoryPreview story={summaryFromEntry(openSaved)} eyebrow="Saved to your bookshelf" onClose={() => setOpenSavedId(null)} {...stepper(savedSorted, openSaved.id, setOpenSavedId)}>
          <LibraryActions entry={openSaved} onCopied={() => flash("Link copied. Paste it anywhere to share.")} />
        </StoryPreview>
      )}
      {open && (
        <StoryPreview story={summaryFromEntry(open)} eyebrow="On your bookshelf" onClose={() => setOpenId(null)} {...stepper(sorted, open.id, setOpenId)}>
          <div className="story-preview-actions">
            <PreviewButtons
              href={`/store/${open.id}`}
              label="Read"
              onShare={() =>
                shareStory(open.title || "An untitled story", shareUrl(open.id, window.location.origin), () =>
                  flash("Link copied. Paste it anywhere to share."),
                )
              }
            />
          </div>
        </StoryPreview>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
