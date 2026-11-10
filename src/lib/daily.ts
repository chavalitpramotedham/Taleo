import type { GalleryEntry } from "./types";

/**
 * The library's story of the day: one published story, the same for
 * everybody on a given date, worked out from the date itself - nothing is
 * stored, and it costs no more than the library list already being read.
 *
 * Stories with a cover that readers haven't rated poorly are in the draw,
 * and they take turns: every one of them has its day before any comes
 * round again.
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

// (FNV-1a: small, quick, and spreads short strings well)
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const avg = (e: GalleryEntry) => (e.ratingCount ? e.ratingSum / e.ratingCount : 0);

/** The pool in its order for one round: every story gets one day per
 *  round, in an order reshuffled each round. */
const round = (pool: GalleryEntry[], r: number) =>
  pool
    .map((e) => ({ e, h: hash(`${r}:${e.id}`) }))
    .sort((a, b) => a.h - b.h || (a.e.id < b.e.id ? -1 : 1))
    .map((x) => x.e);

export function storyOfTheDay(entries: GalleryEntry[], day: string): GalleryEntry | null {
  const n = dayNumber(day);
  // (stories published during the day join the draw tomorrow, so the pick
  // doesn't change under a reader's feet)
  const covered = entries.filter((e) => e.cover);
  const settled = covered.filter((e) => e.createdAt < n * 86_400_000);
  const from = settled.length ? settled : covered;
  const good = from.filter((e) => !e.ratingCount || avg(e) >= 3.5);
  const pool = good.length ? good : from;
  const len = pool.length;
  if (!len) return null;
  if (len === 1) return pool[0];
  const r = Math.floor(n / len);
  const at = n - r * len;
  const order = round(pool, r);
  // A new round mustn't open with the story the last one closed on.
  if (at < 2 && order[0].id === round(pool, r - 1)[len - 1].id) return order[1 - at];
  return order[at];
}
