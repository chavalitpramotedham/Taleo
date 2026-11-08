"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRating, type RatingAggregate } from "@/lib/useRating";
import { StarRating } from "./StarRating";
import { LeafLoader, MapleMark } from "./Icons";

/** Rating a story from its preview: pick stars, add an optional comment,
 *  submit. Shows what you gave if you've already rated it. */
export function InlineRating({
  storyId,
  initial,
  onRated,
}: {
  storyId: string;
  initial: RatingAggregate;
  onRated?: (agg: RatingAggregate) => void;
}) {
  const { data: session } = useSession();
  const { mine, agg, loaded, submit } = useRating(storyId, initial);
  // Once this reader's rating lands, hand the shelf the new totals so the
  // card's stars update too.
  const justRated = useRef(false);
  useEffect(() => {
    if (justRated.current && mine) {
      justRated.current = false;
      onRated?.(agg);
    }
  }, [mine, agg, onRated]);
  const [draft, setDraft] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loaded) return <div className="inline-rating"><LeafLoader size={28} /></div>;
  if (mine) {
    return (
      <div className="inline-rating">
        <p className="meta">You rated this story</p>
        <StarRating value={mine.rating} />
        {mine.comment && <p className="my-comment">&ldquo;{mine.comment}&rdquo;</p>}
      </div>
    );
  }
  if (!session?.user) {
    return (
      <div className="inline-rating">
        <p className="meta">
          <Link href={`/sign-in?next=/store/${storyId}`}>Sign in</Link> to rate this story.
        </p>
      </div>
    );
  }

  const send = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    justRated.current = true;
    const err = await submit(draft, comment).catch(() => "Couldn't save your rating.");
    if (err) justRated.current = false;
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="inline-rating">
      <StarRating value={draft} onChange={busy ? undefined : setDraft} />
      <textarea
        className="input comment-input"
        placeholder="Add a comment (optional)…"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={busy}
      />
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!draft || busy}
        onClick={() => void send()}
      >
        {busy ? (
          <>
            <LeafLoader size={18} /> Saving…
          </>
        ) : draft ? (
          <>
            <MapleMark />
            {`Submit ${draft} star${draft === 1 ? "" : "s"}`}
          </>
        ) : (
          "Tap the stars to rate"
        )}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
