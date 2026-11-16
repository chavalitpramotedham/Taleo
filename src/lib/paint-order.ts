/**
 * A page painted in layers - the place's backdrop underneath, the
 * characters over it - streams the backdrop first. The backdrop of a place
 * nobody has painted yet takes 15-20 seconds, while the characters are
 * usually ready after about 6: rather than hold them back until the
 * backdrop is finished, the server sends them as soon as they're whole,
 * marked, and the backdrop goes on streaming after them.
 *
 * `inPaintOrder` puts a painting's text back in drawing order, for showing
 * it while it's still coming and for keeping it once it's done: the
 * backdrop so far (any of its groups still open closed off), then the
 * characters on top. Text without the marks is returned as it is.
 */

export const OVER_OPEN = "<!--taleo:over-->";
export const OVER_CLOSE = "<!--taleo:/over-->";

export function inPaintOrder(text: string): string {
  if (!text.includes(OVER_OPEN)) return text;
  let under = "";
  let over = "";
  let i = 0;
  while (i < text.length) {
    const a = text.indexOf(OVER_OPEN, i);
    if (a < 0) {
      under += text.slice(i);
      break;
    }
    under += text.slice(i, a);
    const b = text.indexOf(OVER_CLOSE, a);
    // (a marked block still arriving: shown once it's whole - it's sent in
    // one piece, so the rest is a moment away)
    if (b < 0) break;
    over += text.slice(a + OVER_OPEN.length, b);
    i = b + OVER_CLOSE.length;
  }
  if (!over) return under;
  // (the end of the page - "done", a restart - stays at the very end)
  const tail = /\s*<!--taleo:[a-z]+-->\s*$/.exec(under);
  const body = tail ? under.slice(0, tail.index) : under;
  return closeOpen(body) + over + (tail ? tail[0] : "");
}

/** Markup cut off part-way, made whole: a tag half-written at the end is
 *  dropped, and every element still open is closed - so what follows it
 *  isn't drawn inside the backdrop's frame. Whole markup comes back as it
 *  is. */
export function closeOpen(s: string): string {
  const lt = s.lastIndexOf("<");
  if (lt >= 0 && s.indexOf(">", lt) < 0) s = s.slice(0, lt);
  const open: string[] = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z][\w:-]*)\b[^>]*?(\/?)>/g)) {
    if (m[1]) {
      const k = open.lastIndexOf(m[2]);
      if (k >= 0) open.length = k;
    } else if (!m[3]) open.push(m[2]);
  }
  return open.length ? s + open.reverse().map((t) => `</${t}>`).join("") : s;
}
