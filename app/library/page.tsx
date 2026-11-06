"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Story } from "@/lib/types";
import { deleteStory, listStories, saveStory } from "@/lib/storage";
import { castMap, coverPage, wordCount } from "@/lib/story-utils";
import { ageById } from "@/lib/ages";
import { shareUrl } from "@/lib/share";
import { Scene } from "@/components/art/Scene";
import { CharacterAvatar } from "@/components/art/CharacterArt";
import { StarRating } from "@/components/StarRating";
import { presetCharacter, PRESETS } from "@/lib/presets";

type Sort = "recent" | "rating";

export default function LibraryPage() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [toast, setToast] = useState<string | null>(null);

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

  const sorted = useMemo(
    () => (stories ? [...stories].sort((a, b) => (sort === "rating" ? b.rating - a.rating || b.updatedAt - a.updatedAt : b.updatedAt - a.updatedAt)) : []),
    [stories, sort],
  );

  const share = async (s: Story) => {
    const url = shareUrl(s, window.location.origin);
    try {
      if (navigator.share) {
        await navigator.share({ title: s.title, url });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied! 💌");
    } catch {
      window.prompt("Copy this link to share:", url);
    }
    window.setTimeout(() => setToast(null), 2400);
  };

  if (stories === null) return null;

  return (
    <div className="container">
      <div className="wizard-head">
        <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", margin: 0 }}>My stories</h1>
        {stories.length > 1 && (
          <div className="filter-row" style={{ margin: 0 }}>
            <button className={`chip ${sort === "recent" ? "on" : ""}`} onClick={() => setSort("recent")}>
              Newest
            </button>
            <button className={`chip ${sort === "rating" ? "on" : ""}`} onClick={() => setSort("rating")}>
              Favourites
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <CharacterAvatar def={presetCharacter(PRESETS[0])} expression="thinking" />
          <h2>No stories yet</h2>
          <p className="meta">Your finished stories will live here, ready to read again and again.</p>
          <Link className="btn btn-primary" href="/create">
            ✨ Make our first story
          </Link>
        </div>
      ) : (
        <div className="lib-grid">
          {sorted.map((s) => {
            const cover = coverPage(s);
            const minutes = Math.max(1, Math.round(wordCount(s) / 90 + s.segments.reduce((n, g) => n + g.pages.length, 0) * 0.12));
            return (
              <article key={s.id} className="story-card">
                <Link href={`/story/${s.id}`} className="cover" aria-label={`Read ${s.title}`}>
                  {cover && <Scene page={cover} cast={castMap(s)} customProps={s.customProps} animate={false} title={s.title} />}
                  <span className="badge">{s.status === "complete" ? `Age ${ageById(s.age).label}` : "✏️ Unfinished"}</span>
                </Link>
                <div className="body">
                  <h3>{s.title || "Untitled story"}</h3>
                  <div className="meta">
                    {s.hero.name} · ~{minutes} min · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                  <StarRating
                    small={false}
                    value={s.rating}
                    onChange={(r) => saveStory({ ...s, rating: r })}
                  />
                  <div className="card-actions">
                    <Link className="btn btn-primary btn-sm" href={`/story/${s.id}`}>
                      {s.status === "complete" ? "📖 Read" : "Continue"}
                    </Link>
                    {s.status === "complete" && (
                      <button className="btn btn-soft btn-sm" onClick={() => share(s)}>
                        💌 Share
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete “${s.title || "this story"}”?`)) deleteStory(s.id);
                      }}
                      aria-label={`Delete ${s.title}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
