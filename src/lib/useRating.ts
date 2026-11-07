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
export function useRating(id: string, initial: RatingAggregate) {
  const { data: session } = useSession();
  const [mine, setMine] = useState<RatingRecord | null>(null);
  const [agg, setAgg] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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
  }, [id]);

  const submit = async (rating: number, comment: string): Promise<string | null> => {
    if (!session?.user) return "Sign in to rate this story.";
    if (mine) return null;
    const res = await fetch(`/api/gallery/${id}/rate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    const data = await res.json();
    if (!res.ok) return data.error || "Couldn't save your rating.";
    setMine(data.record);
    setAgg({ ratingSum: data.ratingSum, ratingCount: data.ratingCount });
    return null;
  };

  return { mine, agg, loaded, submit, canRate: Boolean(session?.user) && !mine };
}
