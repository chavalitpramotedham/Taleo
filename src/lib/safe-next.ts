/**
 * Where to go after signing in, from a `?next=` address - only ever a page
 * of this site. Anything else ("https://elsewhere", "//elsewhere",
 * "/\elsewhere", a "javascript:" address) is dropped, so a link dressed up
 * as "sign in to Taleo" can't send someone on to a look-alike page.
 */
export function safeNext(next: string | null | undefined): string | undefined {
  if (typeof next !== "string" || !next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  // (no control characters or backslashes anywhere: browsers read some of
  // them as "//", turning a path into another site's address)
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return undefined;
  try {
    const url = new URL(next, "https://taleo.invalid");
    if (url.origin !== "https://taleo.invalid") return undefined;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // (tidied, "/../..//x" becomes "//x" - another site again)
    return path.startsWith("//") ? undefined : path;
  } catch {
    return undefined;
  }
}
