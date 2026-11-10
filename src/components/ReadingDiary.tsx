"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GalleryEntry } from "@/lib/types";
import { Painting } from "./art/Painting";
import { StoryPreview, stepper, summaryFromEntry } from "./StoryPreview";
import { LibraryActions } from "./GalleryShelf";

/** Library cards already fetched for the diary (null: no longer there). */
const known = new Map<string, GalleryEntry | null>();

async function cardsFor(ids: string[]): Promise<void> {
  const need = ids.filter((id) => !known.has(id));
  if (!need.length) return;
  const res = await fetch(`/api/user/reading?ids=${need.join(",")}`, { cache: "no-store" });
  if (!res.ok) throw new Error("no cards");
  const data = (await res.json()) as { stories?: GalleryEntry[] };
  for (const id of need) known.set(id, null);
  for (const e of data.stories ?? []) known.set(e.id, e);
}

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One day of the reading diary, opened from its square on the chart: the
 * stories made that day first, then the ones read (your own before other
 * people's). Tapping a story opens its preview, as on the bookshelf; the
 * arrows step to the day before or after that has something in it.
 */
export function ReadingDiary({
  day,
  made,
  read,
  mine,
  earlier,
  later,
  onDay,
  onClose,
}: {
  day: string;
  /** Stories of your own made this day (newest first). */
  made: string[];
  /** Stories finished this day. */
  read: string[];
  /** Every story of your own (to tell them from other people's). */
  mine: Set<string>;
  earlier: string | null;
  later: string | null;
  onDay: (day: string) => void;
  onClose: () => void;
}) {
  const [ready, setReady] = useState<"loading" | "ready" | "failed">("loading");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Made first; then read - your own stories before other people's.
  const again = read.filter((id) => !made.includes(id));
  const ids = [...made, ...again.filter((id) => mine.has(id)), ...again.filter((id) => !mine.has(id))];
  const key = ids.join(",");
  useEffect(() => {
    let live = true;
    setReady("loading");
    cardsFor(key ? key.split(",") : [])
      .then(() => live && setReady("ready"))
      .catch(() => live && setReady("failed"));
    return () => {
      live = false;
    };
  }, [key]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !openId && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, openId]);

  const rows = ready === "ready" ? ids.flatMap((id) => (known.get(id) ? [known.get(id)!] : [])) : [];
  const gone = ready === "ready" ? ids.length - rows.length : 0;
  const madeHere = rows.filter((e) => made.includes(e.id)).length;
  const readHere = rows.length - madeHere;
  const open = openId ? rows.find((e) => e.id === openId) : null;
  const summary = [madeHere && count(madeHere, "story made", "stories made"), readHere && count(readHere, "story read", "stories read")].filter(Boolean).join(" · ");

  if (open)
    return createPortal(
      <>
        <StoryPreview story={summaryFromEntry(open)} eyebrow={longDate(day)} onClose={() => setOpenId(null)} {...stepper(rows, open.id, setOpenId)}>
          <LibraryActions
            entry={open}
            onCopied={() => {
              setToast("Link copied. Paste it anywhere to share.");
              window.setTimeout(() => setToast(null), 2400);
            }}
          />
        </StoryPreview>
        {toast && <div className="toast">{toast}</div>}
      </>,
      document.body,
    );

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel draft-prompt diary-prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Your reading diary, ${longDate(day)}`}>
        <div className="modal-head">
          <h3>Reading diary</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="draft-title">{longDate(day)}</p>
        <p className="meta diary-summary">
          {ready === "loading" ? "Opening the diary…" : ready === "failed" ? "The diary can't be reached right now. Try again in a moment." : summary || "You finished a story together."}
        </p>
        {rows.length > 0 && (
          <ul className="diary-list">
            {rows.map((e) => {
              const own = mine.has(e.id);
              const isMade = made.includes(e.id);
              return (
                <li key={e.id}>
                  <button type="button" className="diary-row" onClick={() => setOpenId(e.id)} aria-haspopup="dialog">
                    <span className="diary-thumb">{e.cover ? <Painting svg={e.cover} title="" /> : null}</span>
                    <span className="diary-row-text">
                      <span className="diary-row-title">{e.title || "An untitled story"}</span>
                      <span className="diary-row-meta">
                        <span className={`diary-tag${isMade ? " made" : own ? " own" : ""}`}>{isMade ? "Made this day" : own ? "Your story" : "Read"}</span>
                        {isMade ? (read.includes(e.id) ? "and read to the end" : "") : own ? "read again" : `by ${e.authorUsername || "taleo"}`}
                      </span>
                    </span>
                    <span className="diary-row-go" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {ready === "ready" && !ids.length && <p className="meta starts-left">This day is from before the diary began keeping titles.</p>}
        {gone > 0 && (
          <p className="meta starts-left">
            {gone === 1 ? "One story from this day is" : `${gone} stories from this day are`} no longer in the library.
          </p>
        )}
        <div className="diary-step">
          <button type="button" className="link-btn" onClick={() => earlier && onDay(earlier)} disabled={!earlier}>
            ‹ Earlier day
          </button>
          <button type="button" className="link-btn" onClick={() => later && onDay(later)} disabled={!later}>
            Later day ›
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
