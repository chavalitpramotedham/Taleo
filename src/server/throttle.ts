/**
 * A simple brake, kept in this server's memory: at most `count` of
 * something per account in `windowMs`. For things that are cheap to us but
 * shouldn't be scripted - opening payment pages, say - where a per-server
 * count is plenty.
 */
const seen = new Map<string, number[]>();

/** True if this one is allowed (and counts it); false if over the limit. */
export function allow(key: string, count: number, windowMs: number, now = Date.now()): boolean {
  const recent = (seen.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= count) {
    seen.set(key, recent);
    return false;
  }
  recent.push(now);
  seen.set(key, recent);
  if (seen.size > 10_000) for (const [k, v] of seen) if (!v.some((t) => now - t < windowMs)) seen.delete(k);
  return true;
}
