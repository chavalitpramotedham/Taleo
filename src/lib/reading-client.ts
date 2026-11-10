"use client";

/** Your own calendar day ("YYYY-MM-DD") in this device's time zone. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const LOGGED = "taleo.readingLogged.v2";

/** Marks today as a reading day for this account, with the story that was
 *  finished - once a day per story at most (remembered on this device, so
 *  reading the same story again costs nothing). */
export function logReadingToday(userId: string, storyId?: string) {
  const day = localDay();
  const key = `${userId}:${day}`;
  let done: string[] = [];
  try {
    const kept = JSON.parse(localStorage.getItem(LOGGED) || "null") as { key?: string; ids?: string[] } | null;
    if (kept?.key === key && Array.isArray(kept.ids)) done = kept.ids;
  } catch {}
  const id = storyId && /^[a-z0-9]{1,64}$/i.test(storyId) ? storyId : "";
  if (done.includes(id) || (done.length && !id)) return;
  void fetch("/api/user/reading", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day, story: id || undefined }) })
    .then((r) => {
      if (!r.ok) return;
      try {
        localStorage.setItem(LOGGED, JSON.stringify({ key, ids: [...done, id] }));
      } catch {}
    })
    .catch(() => {});
}

/** The current streak: consecutive reading days up to today (or up to
 *  yesterday, if today's story hasn't happened yet). */
export function currentStreak(days: Set<string>, today = new Date()): number {
  const d = new Date(today);
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(localDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
