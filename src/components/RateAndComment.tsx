"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { formatRating, useRating, type RatingAggregate } from "@/lib/useRating";
import { StarRating } from "./StarRating";

export function RateAndComment({ storyId, initial }: { storyId: string; initial: RatingAggregate }) {
  const { data: session } = useSession();
  const { mine, agg, loaded, submit, canRate } = useRating(storyId, initial);
  const [draft, setDraft] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async (rating: number) => {
    setDraft(rating);
    setBusy(true);
    setError(null);
    const err = await submit(rating, comment);
    if (err) setError(err);
    setBusy(false);
  };

  if (!loaded) return null;

  if (mine) {
    return (
      <div className="rate-block">
        <StarRating value={mine.rating} />
        <p className="meta rating-summary">{formatRating(agg.ratingSum, agg.ratingCount)}</p>
        <p className="meta">You rated this {mine.rating} star{mine.rating === 1 ? "" : "s"}{mine.comment ? ":" : "."}</p>
        {mine.comment && <p className="my-comment">&ldquo;{mine.comment}&rdquo;</p>}
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="rate-block">
        <p className="meta rating-summary">{formatRating(agg.ratingSum, agg.ratingCount)}</p>
        <p className="meta">
          <Link href={`/sign-in?next=/store/${storyId}`}>Sign in</Link> to rate this story.
        </p>
      </div>
    );
  }

  return (
    <div className="rate-block">
      <StarRating value={draft} onChange={canRate ? go : undefined} />
      <p className="meta rating-summary">{formatRating(agg.ratingSum, agg.ratingCount)}</p>
      <textarea
        className="input comment-input"
        placeholder="Leave a comment with your rating (optional)…"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={busy}
      />
      <p className="meta">Tap a star above to submit your rating{comment.trim() ? " and comment" : ""} — this can&apos;t be changed afterwards.</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
