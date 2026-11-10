/**
 * A forgiving match of what was typed against a name: the letters typed
 * must all appear in the name in order, but not side by side ("chvlt"
 * finds "chavalit"), and one letter may be wrong or missing. Returns how
 * good the match is (higher is better), or null for no match.
 */
export function fuzzyScore(typed: string, name: string): number | null {
  const q = typed.toLowerCase().replace(/\s+/g, "");
  const s = name.toLowerCase();
  if (!q) return 0;
  if (!s) return null;
  const at = s.indexOf(q);
  if (at >= 0) return 1000 - at * 2 - (s.length - q.length);
  const inOrder = (needle: string) => {
    let from = 0;
    let gaps = 0;
    for (const ch of needle) {
      const i = s.indexOf(ch, from);
      if (i < 0) return null;
      gaps += i - from;
      from = i + 1;
    }
    return 500 - gaps * 4 - (s.length - needle.length);
  };
  const whole = inOrder(q);
  if (whole !== null) return whole;
  // one slip of the finger: any one letter typed may be left out
  if (q.length < 5) return null;
  let best: number | null = null;
  for (let i = 0; i < q.length; i++) {
    const score = inOrder(q.slice(0, i) + q.slice(i + 1));
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best === null ? null : best - 200;
}

/** The people a search finds, best match first: by handle or by email
 *  (the part before the @ counts for more than the address's domain). */
export function fuzzyPeople<T extends { username?: string | null; email: string }>(typed: string, people: T[]): T[] {
  const q = typed.trim().replace(/^@/, "");
  if (!q) return [];
  const scored: { p: T; score: number }[] = [];
  for (const p of people) {
    const scores = [fuzzyScore(q, p.username ?? ""), fuzzyScore(q, p.email.split("@")[0]), q.includes("@") || q.includes(".") ? fuzzyScore(q, p.email) : null].filter((n): n is number => n !== null);
    if (scores.length) scored.push({ p, score: Math.max(...scores) });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.p);
}
