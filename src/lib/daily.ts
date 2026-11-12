import type { GalleryEntry } from "./types";

/**
 * The library's story of the day: of the stories made in the last three
 * days, the one opened by the most readers today - the same for everybody
 * on a given date.
 *
 * Ties (and the start of a day, when nothing has been opened yet) go to
 * the better rated, then the more often rated, then the older story. So
 * the pick can change during the day as stories are read.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
const dayOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** Today's date where the reader is (YYYY-MM-DD). */
export function localDay(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The date to pick for: the reader's own, if it's a real date within a
 *  day of the server's (time zones), otherwise the server's. */
export function pickDay(asked: string | null | undefined, now = Date.now()): string {
  const today = Math.floor(now / 86_400_000);
  if (asked && DAY.test(asked)) {
    const n = dayNumber(asked);
    if (Number.isFinite(n) && Math.abs(n - today) <= 1) return asked;
  }
  return dayOf(today);
}

const avg = (e: GalleryEntry) => (e.ratingCount ? e.ratingSum / e.ratingCount : 0);

/** How new a story must be to be the story of the day. */
export const DAILY_FRESH_DAYS = 3;

/** `views`: how often each story (by id) was opened on that day. Only
 *  stories with a cover are in the running (the pick is shown by it), and
 *  only those made in the last three days - so the pick keeps moving on
 *  to new stories instead of resting on an old favourite. (If nothing at
 *  all was made in that time, the whole library is in the running, so
 *  there is always a story of the day.) */
export function storyOfTheDay(entries: GalleryEntry[], views: Record<string, number> = {}, now = Date.now()): GalleryEntry | null {
  const seen = (e: GalleryEntry) => views[e.id] ?? 0;
  const shown = entries.filter((e) => e.cover);
  const fresh = shown.filter((e) => now - e.createdAt <= DAILY_FRESH_DAYS * 86_400_000);
  const [first] = (fresh.length ? fresh : shown).sort((a, b) => seen(b) - seen(a) || avg(b) - avg(a) || b.ratingCount - a.ratingCount || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  return first ?? null;
}
