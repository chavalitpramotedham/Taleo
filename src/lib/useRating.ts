"use client";
import { useState } from "react";
import { getMyRating, setMyRating } from "./my-ratings";
import { rateGalleryStory, type RatingAggregate } from "./gallery-client";

/** Formats a community rating for display, e.g. "4.2 · 13 ratings". */
export function formatRating(sum: number, count: number): string {
  if (!count) return "Not yet rated";
  return `${(sum / count).toFixed(1)} · ${count} rating${count === 1 ? "" : "s"}`;
}

/**
 * Tracks this device's own vote for a story (in localStorage, keyed by id)
 * and the story's community aggregate, submitting changes to the public
 * store. `onVote` is for callers that also keep a local copy of the vote
 * elsewhere (a bookshelf Story's own `rating` field).
 */
export function useRating(id: string, initial: RatingAggregate, initialMine = 0, onVote?: (rating: number) => void) {
  const [mine, setMine] = useState(() => getMyRating(id) || initialMine);
  const [agg, setAgg] = useState(initial);

  const vote = async (rating: number) => {
    const previous = mine || undefined;
    setMine(rating);
    setMyRating(id, rating);
    onVote?.(rating);
    const next = await rateGalleryStory(id, rating, previous);
    if (next) setAgg(next);
  };

  return { mine, agg, vote };
}
