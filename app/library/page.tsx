"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Story } from "@/lib/types";
import { deleteStory, listStories, saveStory } from "@/lib/storage";
import { fetchGallery, publishToGallery } from "@/lib/gallery-client";
import { coverSvg, wordCount } from "@/lib/story-utils";
import { ageById } from "@/lib/ages";
import { storeUrl } from "@/lib/share";
import { formatRating, useRating } from "@/lib/useRating";
import { PRESETS, presetCharacter } from "@/lib/presets";
import { Painting, CharacterPortrait } from "@/components/art/Painting";
import { StarRating } from "@/components/StarRating";
import { Ornament } from "@/components/Icons";

type Sort = "recent" | "rating";

export default function LibraryPage() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [toast, setToast] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, { ratingSum: number; ratingCount: number }>>({});

  useEffect(() => {
    const load = () => setStories(listStories().filter((s) => s.segments.length > 0));
    load();
    window.addEventListener("taleo:stories", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("taleo:stories", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  useEffect(() => {
    fetchGallery().then((entries) => {
      const byId: Record<string, { ratingSum: number; ratingCount: number }> = {};
      for (const e of entries) byId[e.id] = { ratingSum: e.ratingSum, ratingCount: e.ratingCount };
      setRatings(byId);
    });
  }, []);

  const sorted = useMemo(
    () => (stories ? [...stories].sort((a, b) => (sort === "rating" ? b.rating - a.rating || b.updatedAt - a.updatedAt : b.updatedAt - a.updatedAt)) : []),
    [stories, sort],
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  if (stories === null) return null;

  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">Your bookshelf</p>
        <h1>Stories we made</h1>
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
          <h2>The shelf is empty, for now</h2>
          <p className="meta">Finished stories live here, ready to read again and again.</p>
          <Link className="btn btn-primary" href="/create">
            Begin our first story
          </Link>
        </div>
      ) : (
        <div className="shelf">
          {sorted.map((s) => (
            <BookCard key={s.id} story={s} aggregate={ratings[s.id]} flash={flash} />
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function BookCard({
  story: s,
  aggregate,
  flash,
}: {
  story: Story;
  aggregate?: { ratingSum: number; ratingCount: number };
  flash: (msg: string) => void;
}) {
  const { mine, agg, vote } = useRating(
    s.id,
    aggregate ?? { ratingSum: s.ratingSum ?? 0, ratingCount: s.ratingCount ?? 0 },
    s.rating,
    (r) => saveStory({ ...s, rating: r }),
  );

  const ensurePublished = async () => {
    if (s.published) return;
    const ok = await publishToGallery(s);
    if (ok) saveStory({ ...s, published: true });
  };

  const shareLink = () => storeUrl(s.id, window.location.origin);

  const copyLink = async () => {
    await ensurePublished();
    const url = shareLink();
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied. Paste it anywhere to share.");
    } catch {
      window.prompt("Copy this link to share:", url);
    }
  };

  const share = async () => {
    await ensurePublished();
    const url = shareLink();
    try {
      if (navigator.share) {
        await navigator.share({ title: s.title, url });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    await copyLink();
  };

  const cover = coverSvg(s);
  const pages = s.segments.reduce((n, g) => n + g.pages.length, 0);
  const minutes = Math.max(1, Math.round(wordCount(s) / 90 + pages * 0.12));

  return (
    <article className="book-card">
      <Link href={`/story/${s.id}`} className="cover" aria-label={`Read ${s.title}`}>
        {cover ? <Painting svg={cover} title={s.title} /> : <CharacterPortrait character={s.hero} className="cover-portrait" />}
      </Link>
      <div className="body">
        <h3>{s.title || "An untitled story"}</h3>
        <Ornament className="ornament small" />
        <p className="meta">
          {s.status === "complete" ? `For ages ${ageById(s.age).label}` : "Still being written"} · about {minutes} min
          <br />
          {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <StarRating value={mine} onChange={vote} />
        {s.status === "complete" && <p className="meta rating-summary">{formatRating(agg.ratingSum, agg.ratingCount)}</p>}
        <div className="card-actions">
          <Link className="btn btn-primary btn-sm" href={`/story/${s.id}`}>
            {s.status === "complete" ? "Read" : "Continue"}
          </Link>
          {s.status === "complete" && (
            <>
              <button className="btn btn-soft btn-sm" onClick={share}>
                Share
              </button>
              <button className="btn btn-soft btn-sm" onClick={copyLink}>
                Copy link
              </button>
            </>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm(`Remove “${s.title || "this story"}” from the shelf?`)) deleteStory(s.id);
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
