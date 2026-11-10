"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { RatingRecord } from "./types";

/** Formats a community rating for display, e.g. "4.2 · 13 ratings". */
export function formatRating(sum: number, count: number): string {
  if (!count) return "Not yet rated";
  return `${(sum / count).toFixed(1)} · ${count} rating${count === 1 ? "" : "s"}`;
}

export interface RatingAggregate {
  ratingSum: number;
  ratingCount: number;
}

/**
 * One rating per signed-in user per story, enforced server-side: once rated,
 * the same submission (rating + comment) is returned instead of a new one
 * being recorded, so the UI should treat `mine` as locked once present.
 */
export function useRating(id: string, initial: RatingAggregate, unpublished = false) {
  const { data: session, status } = useSession();
  const [mine, setMine] = useState<RatingRecord | null>(null);
  const [agg, setAgg] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    // Signed out, there's no rating of yours to look up - skip the request.
    // Nor for a story that isn't in the store yet (your own, just ended):
    // nobody can have rated it, and asking only earns a "not found".
    if (status === "unauthenticated" || unpublished) {
      setLoaded(true);
      return;
    }
    let live = true;
    fetch(`/api/gallery/${id}/ratings`)
      .then((r) => r.json())
      .then((d: { mine?: RatingRecord | null }) => {
        if (live) {
          setMine(d.mine ?? null);
          setLoaded(true);
        }
      })
      .catch(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [id, status, unpublished]);

  const submit = async (rating: number, comment: string): Promise<string | null> => {
    if (!session?.user) return "Sign in to rate this story.";
    if (mine) return null;
    const res = await fetch(`/api/gallery/${id}/rate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment: comment.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.record) return data.error || "Couldn't save your rating.";
    setMine(data.record);
    setAgg({ ratingSum: data.ratingSum, ratingCount: data.ratingCount });
    return null;
  };

  return { mine, agg, loaded, submit };
}
