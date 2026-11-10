import { readJson, writeJson } from "./store";

/**
 * A family's reading diary - one small file per account: the dates (in the
 * family's own time zone, "YYYY-MM-DD") they finished a story, and which
 * stories they finished on each. A write happens only when there is
 * something new to keep: the first story of a day, and each different
 * story after it (a handful a day at the very most) - reading the same
 * story again costs nothing.
 */
const pathFor = (userId: string) => `users/reading/${userId}.json`;
const KEEP_DAYS = 400; // a little over a year - enough for the chart and long streaks
const PER_DAY = 6; // titles kept for one day
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9]{1,64}$/i;

export interface ReadingDiary {
  days: string[];
  /** The stories finished on a day (days from before titles were kept
   *  have none). */
  read: Record<string, string[]>;
}

export async function readingDiary(userId: string): Promise<ReadingDiary> {
  // (the file used to be just the list of days)
  const raw = await readJson<string[] | Partial<ReadingDiary>>(pathFor(userId), { fresh: true });
  if (Array.isArray(raw)) return { days: raw, read: {} };
  return { days: Array.isArray(raw?.days) ? raw.days : [], read: raw?.read && typeof raw.read === "object" ? raw.read : {} };
}

const trimmed = (d: ReadingDiary): ReadingDiary => {
  const days = [...new Set(d.days)].sort().slice(-KEEP_DAYS);
  const kept = new Set(days);
  return { days, read: Object.fromEntries(Object.entries(d.read).filter(([day]) => kept.has(day))) };
};

/** Records a reading day, and the story finished on it (no write if both
 *  are already there). */
export async function logReadingDay(userId: string, day: string, storyId?: string): Promise<ReadingDiary> {
  if (!DAY_RE.test(day)) throw new Error("Not a day.");
  const diary = await readingDiary(userId);
  const had = diary.read[day] ?? [];
  const add = storyId && ID_RE.test(storyId) && !had.includes(storyId) && had.length < PER_DAY ? storyId : null;
  if (diary.days.includes(day) && !add) return diary;
  const next = trimmed({ days: [...diary.days, day], read: add ? { ...diary.read, [day]: [...had, add] } : diary.read });
  await writeJson(pathFor(userId), next);
  return next;
}

/** Adds days logged by hand (no write if they're all there already). */
export async function addReadingDays(userId: string, diary: ReadingDiary, add: string[]): Promise<ReadingDiary> {
  const missing = add.filter((d) => DAY_RE.test(d) && !diary.days.includes(d));
  if (!missing.length) return diary;
  const next = trimmed({ days: [...diary.days, ...missing], read: diary.read });
  await writeJson(pathFor(userId), next);
  return next;
}
