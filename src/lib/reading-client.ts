"use client";

/** Your own calendar day ("YYYY-MM-DD") in this device's time zone. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const LOGGED = "taleo.readingLogged.v1";

/** Marks today as a reading day for this account - once a day at most
 *  (remembered on this device, so reading more stories costs nothing). */
export function logReadingToday(userId: string) {
  const day = localDay();
  const key = `${userId}:${day}`;
  try {
    if (localStorage.getItem(LOGGED) === key) return;
  } catch {}
  void fetch("/api/user/reading", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day }) })
    .then((r) => {
      if (!r.ok) return;
      try {
        localStorage.setItem(LOGGED, key);
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
