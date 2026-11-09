import { readJson, writeJson } from "./store";

/**
 * The days a family read together - one small file per account, holding
 * the dates (in the family's own time zone, "YYYY-MM-DD") they read at
 * least a few pages. Logged at most once a day, so it costs at most one
 * write per family per day.
 */
const pathFor = (userId: string) => `users/reading/${userId}.json`;
const KEEP_DAYS = 400; // a little over a year - enough for the chart and long streaks
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function readingDays(userId: string): Promise<string[]> {
  return (await readJson<string[]>(pathFor(userId), { fresh: true })) ?? [];
}

/** Records a reading day (no write if it's already there). */
export async function logReadingDay(userId: string, day: string): Promise<string[]> {
  if (!DAY_RE.test(day)) throw new Error("Not a day.");
  const days = await readingDays(userId);
  if (days.includes(day)) return days;
  const next = [...days, day].sort().slice(-KEEP_DAYS);
  await writeJson(pathFor(userId), next);
  return next;
}
