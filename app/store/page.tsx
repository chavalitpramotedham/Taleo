"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GalleryEntry } from "@/lib/types";
import { fetchGallery } from "@/lib/gallery-client";
import { ageById } from "@/lib/ages";
import { Painting, CharacterPortrait } from "@/components/art/Painting";
import { StarRating } from "@/components/StarRating";
import { Ornament } from "@/components/Icons";
import { PRESETS, presetCharacter } from "@/lib/presets";

type Sort = "recent" | "rating";

export default function StorePage() {
  const [stories, setStories] = useState<GalleryEntry[] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchGallery()
      .then(setStories)
      .catch(() => setError(true));
  }, []);

  const sorted = useMemo(
    () => (stories ? [...stories].sort((a, b) => (sort === "rating" ? b.rating - a.rating || b.createdAt - a.createdAt : b.createdAt - a.createdAt)) : []),
    [stories, sort],
  );

  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">Open to everyone</p>
        <h1>The story store</h1>
        <p className="sub">Every finished story, painted and shared by families like yours.</p>
        {stories && stories.length > 1 && (
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

      {stories === null ? null : error ? (
        <div className="empty">
          <h2>The store couldn&apos;t open just now</h2>
          <p className="meta">Please try again in a moment.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty">
          <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
          <h2>The store is empty, for now</h2>
          <p className="meta">Finished stories appear here for anyone to read.</p>
          <Link className="btn btn-primary" href="/create">
            Begin the first story
          </Link>
        </div>
      ) : (
        <div className="shelf">
          {sorted.map((s) => (
            <article key={s.id} className="book-card">
              <Link href={`/store/${s.id}`} className="cover" aria-label={`Read ${s.title}`}>
                {s.cover ? <Painting svg={s.cover} title={s.title} /> : null}
              </Link>
              <div className="body">
                <h3>{s.title || "An untitled story"}</h3>
                <Ornament className="ornament small" />
                <p className="meta">
                  {s.heroName ? `${s.heroName}'s story · ` : ""}For ages {ageById(s.age).label}
                  <br />
                  {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <StarRating value={s.rating} />
                <div className="card-actions">
                  <Link className="btn btn-primary btn-sm" href={`/store/${s.id}`}>
                    Read
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
