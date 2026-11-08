"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { GalleryEntry } from "@/lib/types";
import { shareUrl, shareStory } from "@/lib/share";
import { CharacterPortrait } from "@/components/art/Painting";
import { MapleMark, StarGlyph } from "@/components/Icons";
import { StoryCard } from "@/components/StoryCard";
import { PreviewButtons, StoryPreview, summaryFromEntry } from "@/components/StoryPreview";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { CategoryFilter, categoriesOf, matchesCategory } from "@/components/CategoryFilter";
import { PageLoading } from "@/components/PageLoading";

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
  }, [status]);

  const sorted = useMemo(
    () =>
      stories
        ? [...stories]
            .filter((e) => matchesCategory(e, category))
            .sort((a, b) => (sort === "rating" ? avg(b) - avg(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt))
        : [],
    [stories, sort, category],
  );
  const categories = useMemo(() => categoriesOf(stories ?? []), [stories]);

  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? stories?.find((e) => e.id === openId) ?? null : null;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  if (status !== "authenticated" || stories === null) return <PageLoading label="Fetching your bookshelf…" />;

  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">Just yours</p>
        <h1>My bookshelf</h1>
        {stories.length > 1 && (
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
      {open && (
        <StoryPreview story={summaryFromEntry(open)} eyebrow="On your bookshelf" onClose={() => setOpenId(null)}>
          <div className="story-preview-actions">
            <PreviewButtons
              href={`/store/${open.id}`}
              label="Read the story"
              onShare={() =>
                shareStory(open.title || "An untitled story", shareUrl(open.id, window.location.origin), () =>
                  flash("Link copied. Paste it anywhere to share."),
                )
              }
            />
            {open.ratingCount > 0 && (
              <p className="meta story-preview-ratings">
                <StarGlyph /> {avg(open).toFixed(1)} from {open.ratingCount} {open.ratingCount === 1 ? "rating" : "ratings"}
                <span aria-hidden> · </span>
                <Link href={`/my-stories/${open.id}/ratings`}>See ratings</Link>
              </p>
            )}
          </div>
        </StoryPreview>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
