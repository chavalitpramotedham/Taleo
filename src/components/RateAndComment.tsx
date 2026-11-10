"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { formatRating, useRating, type RatingAggregate } from "@/lib/useRating";
import { StarRating } from "./StarRating";
import { LeafLoader, StarGlyph, MapleMark } from "./Icons";

/** The end-of-story rating, as its own floating panel: pick stars, add an
 *  optional comment, then submit both together. Closable with ✕, and it
 *  minimises to a small pill once submitted (tap the pill to reopen it and
 *  see what you rated). One rating per reader per story, locked after
 *  submitting. `prepare` runs first so the rating has a published story
 *  to attach to (a story only reaches the store once fully painted). */
export function RateAndComment({
  storyId,
  initial,
  prepare,
  inline = false,
  unpublished = false,
}: {
  storyId: string;
  initial: RatingAggregate;
  prepare?: () => Promise<void>;
  /** Part of the page (the end of a story) rather than a floating panel:
   *  always shown, never minimised. */
  inline?: boolean;
  /** Not in the store yet, so there is no rating of yours to look up. */
  unpublished?: boolean;
}) {
  const { data: session } = useSession();
  const { mine, agg, loaded, submit } = useRating(storyId, initial, unpublished);
  const [open, setOpen] = useState<boolean | null>(null);
  const [draft, setDraft] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start open for anyone who hasn't rated yet, minimised for those who have
  // (inline: always open, it's part of the page).
  useEffect(() => {
    if (loaded && open === null) setOpen(inline || !mine);
  }, [loaded, mine, open, inline]);

  const send = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      await prepare?.();
      const err = await submit(draft, comment);
      if (err) setError(err);
      else if (!inline) setOpen(false);
    } catch {
      setError("Couldn't save your rating. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded || open === null) return null;

  if (!open) {
    return (
      <button type="button" className="rating-pill" onClick={() => setOpen(true)}>
        <StarGlyph />
        {mine ? `You rated ${mine.rating}` : "Rate this story"}
      </button>
    );
  }

  return (
    <section className={inline ? "rating-panel rating-inline" : "rating-panel"} aria-label="Rate this story">
      <div className="rating-panel-head">
        <h3>{mine ? "Your rating" : "Rate this story"}</h3>
        {!inline && (
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
        )}
      </div>

      {mine ? (
        <>
          <StarRating value={mine.rating} />
          {mine.comment && <p className="my-comment">&ldquo;{mine.comment}&rdquo;</p>}
          <p className="meta rating-summary">{formatRating(agg.ratingSum, agg.ratingCount)}</p>
        </>
      ) : !session?.user ? (
        <>
          <p className="meta rating-summary">{formatRating(agg.ratingSum, agg.ratingCount)}</p>
          <p className="meta">
            <Link href={`/sign-in?next=/store/${storyId}`}>Sign in</Link> to rate this story.
          </p>
        </>
      ) : (
        <>
          <StarRating value={draft} onChange={busy ? undefined : setDraft} />
          <textarea
            className="input comment-input"
            placeholder="Add a comment (optional)…"
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={busy}
          />
          <button type="button" className="btn btn-primary btn-block" onClick={send} disabled={!draft || busy}>
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
          <p className="meta rating-note">Ratings can&apos;t be changed after submitting.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
