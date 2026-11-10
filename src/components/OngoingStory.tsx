"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { Story } from "@/lib/types";
import { allPages } from "@/lib/story-utils";
import { Painting } from "./art/Painting";
import { LeafLoader, MapleMark } from "./Icons";

export const titleOf = (s: Story) => s.title || `${s.hero.name}'s story`;
export const coverOf = (s: Story) => allPages(s).find((p) => p.svg)?.svg ?? null;
const soFar = (s: Story) => {
  const pages = allPages(s).length;
  return pages ? `${pages} page${pages === 1 ? "" : "s"} so far` : "Just begun";
};

/** The story under way, as shown inside a dialog: its picture, its title
 *  and how far it has got. */
export function OngoingSummary({ story }: { story: Story }) {
  const cover = coverOf(story);
  return (
    <>
      {cover && (
        <Painting svg={cover} title={titleOf(story)} className="draft-cover" />
      )}
      <p className="draft-title">{titleOf(story)}</p>
      <p className="meta">
        Starring {story.hero.name} · {soFar(story)}
      </p>
    </>
  );
}

/**
 * The story under way, as the first card on the bookshelf row: tap it to
 * carry on where it was left; the ✕ in its corner throws it away (after
 * asking - it can't be brought back).
 */
export function OngoingCard({
  story,
  onResume,
  onDiscard,
}: {
  story: Story;
  onResume: () => void;
  onDiscard: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const cover = coverOf(story);
  const title = titleOf(story);
  return (
    <div className="book-card story-card ongoing-card">
      <button
        type="button"
        className="ongoing-open"
        onClick={onResume}
        aria-label={`${title} - carry on with this story`}
      >
        <span className="cover">
          {cover ? (
            <Painting svg={cover} title={title} />
          ) : (
            <span className="ongoing-blank" aria-hidden />
          )}
          <span className="cover-time ongoing-badge">Unfinished</span>
        </span>
        <span className="body">
          <span className="story-card-title">{title}</span>
          <span className="ongoing-meta">{soFar(story)}</span>
          <span className="ongoing-cta">
            <MapleMark /> Carry on
          </span>
        </span>
      </button>
      <button
        type="button"
        className="ongoing-discard"
        onClick={() => setAsking(true)}
        aria-label={`Delete ${title}`}
        title="Delete this story"
      >
        ✕
      </button>
      {/* (on the page itself, not inside the card: the row scrolls and the
          card lifts on hover, either of which would trap a fixed dialog) */}
      {asking &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={() => !busy && setAsking(false)}
          >
            <div
              className="modal-panel confirm-panel"
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-ongoing-delete"
            >
              {cover && (
                <span className="confirm-cover">
                  <Painting svg={cover} title={title} />
                </span>
              )}
              <h3 id="confirm-ongoing-delete">
                Delete &ldquo;{title}&rdquo;?
              </h3>
              <p className="confirm-warning">
                This can&apos;t be undone. The story isn&apos;t finished yet, so
                it will be gone for good.
              </p>
              <div className="redraw-choices">
                <button
                  type="button"
                  className="btn btn-danger btn-block"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onDiscard();
                  }}
                >
                  {busy ? (
                    <>
                      <LeafLoader size={18} /> Deleting…
                    </>
                  ) : (
                    "Yes, delete this story"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-soft btn-block"
                  onClick={() => setAsking(false)}
                  disabled={busy}
                >
                  Keep it
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
