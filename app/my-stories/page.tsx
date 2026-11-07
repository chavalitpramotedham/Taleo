"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { GalleryEntry } from "@/lib/types";
import { storeUrl } from "@/lib/share";
import { formatRating } from "@/lib/useRating";
import { ageById } from "@/lib/ages";
import { Painting, CharacterPortrait } from "@/components/art/Painting";
import { StarRating } from "@/components/StarRating";
import { Ornament } from "@/components/Icons";
import { PRESETS, presetCharacter } from "@/lib/presets";

type Sort = "recent" | "rating";
const avg = (s: GalleryEntry) => (s.ratingCount ? s.ratingSum / s.ratingCount : 0);

export default function MyStoriesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stories, setStories] = useState<GalleryEntry[] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
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
    () => (stories ? [...stories].sort((a, b) => (sort === "rating" ? avg(b) - avg(a) || b.createdAt - a.createdAt : b.createdAt - a.createdAt)) : []),
    [stories, sort],
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  if (status !== "authenticated" || stories === null) return null;

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
          </div>
        )}
      </header>

      {sorted.length === 0 ? (
        <div className="empty">
          <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
          <h2>You haven&apos;t written one yet</h2>
          <p className="meta">Finished stories you create live here.</p>
          <Link className="btn btn-primary" href="/create">
            Begin your first story
          </Link>
        </div>
      ) : (
        <div className="shelf">
          {sorted.map((s) => (
            <MyStoryCard key={s.id} entry={s} onCopied={() => flash("Link copied. Paste it anywhere to share.")} />
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function MyStoryCard({ entry: s, onCopied }: { entry: GalleryEntry; onCopied: () => void }) {
  const copyLink = async () => {
    const url = storeUrl(s.id, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
    } catch {
      window.prompt("Copy this link to share:", url);
    }
  };

  return (
    <article className="book-card">
      <Link href={`/store/${s.id}`} className="cover" aria-label={`Read ${s.title}`}>
        {s.cover ? <Painting svg={s.cover} title={s.title} /> : null}
      </Link>
      <div className="body">
        <h3>{s.title || "An untitled story"}</h3>
        <Ornament className="ornament small" />
        <p className="meta">
          For ages {ageById(s.age).label}
          <br />
          {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <StarRating value={Math.round(avg(s))} />
        <p className="meta rating-summary">{formatRating(s.ratingSum, s.ratingCount)}</p>
        <div className="card-actions">
          <Link className="btn btn-primary btn-sm" href={`/store/${s.id}`}>
            Read
          </Link>
          <Link className="btn btn-soft btn-sm" href={`/my-stories/${s.id}/ratings`}>
            Ratings
          </Link>
          <button className="btn btn-soft btn-sm" onClick={copyLink}>
            Copy link
          </button>
        </div>
      </div>
    </article>
  );
}
