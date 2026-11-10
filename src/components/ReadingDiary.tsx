"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GalleryEntry } from "@/lib/types";
import { Painting } from "./art/Painting";
import { StoryPreview, stepper, summaryFromEntry } from "./StoryPreview";
import { LibraryActions } from "./GalleryShelf";
import { PageLoading } from "./PageLoading";

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

/** The first day the diary noted which stories were read (before it, only
 *  that the day was a reading day). */
const TITLES_FROM = "2026-11-10";

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const at = (day: string) => new Date(`${day}T12:00:00`);
const weekday = (day: string) => at(day).toLocaleDateString(undefined, { weekday: "long" });
const dayMonth = (day: string) => at(day).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One day of the reading diary, opened from its square on the chart: the
 * stories made that day first, then the ones read (your own before other
 * people's). Tapping a story opens its preview, as on the bookshelf; the
 * arrows on either side of the weekday step to the day before or after that
 * has something in it.
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
  // Said once, as a heading over each kind - and only when the day has both.
  const groups = [
    { label: "Made", rows: rows.filter((e) => made.includes(e.id)) },
    { label: "Read", rows: rows.filter((e) => !made.includes(e.id)) },
  ].filter((g) => g.rows.length);
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
        <button type="button" className="icon-btn diary-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {/* The day, with the way to the day before and the day after on
            either side of it (only days with a story in them). */}
        <div className="diary-head">
          <div className="diary-date" aria-live="polite">
            <p className="diary-weekday">
              <button type="button" className="diary-step" onClick={() => earlier && onDay(earlier)} disabled={!earlier} aria-label="Earlier day">
                ‹
              </button>
              <span className="diary-weekday-name">{weekday(day)}</span>
              <button type="button" className="diary-step" onClick={() => later && onDay(later)} disabled={!later} aria-label="Later day">
                ›
              </button>
            </p>
            <p className="diary-day">{dayMonth(day)}</p>
            <p className="diary-summary">
              {ready === "loading" ? "\u00a0" : ready === "failed" ? "The diary can't be reached right now. Try again in a moment." : summary || "A reading day"}
            </p>
          </div>
        </div>
        <div className="diary-body">
          {ready === "loading" && <PageLoading compact label="Opening the diary…" />}
          {rows.length > 0 && (
            <div className="diary-list">
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label}>
                  {groups.length > 1 && <h4 className="diary-group">{g.label}</h4>}
                  <ul>
                    {g.rows.map((e) => {
                      const note = made.includes(e.id) ? (read.includes(e.id) ? "Read to the end" : "") : mine.has(e.id) ? "Your story, read again" : `by @${e.authorUsername || "taleo"}`;
                      return (
                        <li key={e.id}>
                          <button type="button" className="diary-row" onClick={() => setOpenId(e.id)} aria-haspopup="dialog">
                            <span className="diary-thumb">{e.cover ? <Painting svg={e.cover} title="" /> : null}</span>
                            <span className="diary-row-text">
                              <span className="diary-row-title">{e.title || "An untitled story"}</span>
                              {note && <span className="diary-row-meta">{note}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {ready === "ready" && !ids.length && (
            <p className="meta starts-left">
              {day < TITLES_FROM ? "This day is from before the diary began keeping titles." : "A story was finished this day, but the diary didn't note which one."}
            </p>
          )}
          {gone > 0 && (
            <p className="meta starts-left">
              {gone === 1 ? "One story from this day is" : `${gone} stories from this day are`} no longer in the library.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
