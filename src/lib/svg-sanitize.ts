// Whitelist sanitizer for painted SVG (preset art and everything Claude paints).
// It rebuilds the markup from scratch, keeping only simple shape elements and
// presentation attributes, so nothing executable (scripts, event handlers,
// links, foreignObject, external references…) can survive. Layer classes are
// translated into the app's own watercolour filters:
//   class="wash"  -> broad, bleeding background washes
//   class="paint" -> watercolour fills for characters and objects
//   class="ink"   -> fine, slightly wobbly sepia linework
//   class="detail"-> crisp, unfiltered (eyes, tiny highlights)
// It tolerates truncated input, so it can render a painting while it streams in.

const TAGS = new Set(["g", "path", "circle", "ellipse", "rect", "polygon", "polyline", "line"]);
const ATTRS = new Set([
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2",
  "points", "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap",
  "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "transform", "fill-rule",
]);
const LAYER_FILTER: Record<string, string> = {
  wash: "url(#tl-wash)",
  paint: "url(#tl-paint)",
  ink: "url(#tl-ink)",
};
const KNOWN_FILTERS = new Set(Object.values(LAYER_FILTER));
const SAFE_VALUE =/^[#a-zA-Z0-9\s.,\-+()%]*$/;

export function sanitizeSvg(input: string | null | undefined, maxLength = 80000): string {
  if (!input) return "";
  const src = input.slice(0, maxLength * 2).replace(/<!--[\s\S]*?(-->|$)/g, "");
  const out: string[] = [];
  const stack: string[] = [];
  const tagRe = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)([^<>]*?)(\/)?\s*>/g;
  let m: RegExpExecArray | null;
  let skipDepth = 0; // inside a disallowed container: drop everything
  while ((m = tagRe.exec(src))) {
    const [, closing, rawName, rawAttrs, selfClose] = m;
    const name = rawName.toLowerCase();
    const allowed = TAGS.has(name);
    if (closing) {
      if (!allowed) {
        if (skipDepth > 0) skipDepth--;
        continue;
      }
      if (skipDepth === 0 && stack[stack.length - 1] === name) {
        stack.pop();
        out.push(`</${name}>`);
      }
      continue;
    }
    if (!allowed) {
      if (!selfClose && name !== "svg") skipDepth++;
      continue;
    }
    if (skipDepth > 0) continue;
    const attrs: string[] = [];
    const attrRe = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(rawAttrs))) {
      const key = a[1].toLowerCase();
      const val = (a[3] ?? a[4] ?? "").trim();
      if (key === "class") {
        const layer = val.split(/\s+/).find((c) => LAYER_FILTER[c]);
        if (layer) attrs.push(`filter="${LAYER_FILTER[layer]}"`);
        continue;
      }
      // Keep our own layer filters when re-sanitizing already-clean markup.
      if (key === "filter") {
        if (KNOWN_FILTERS.has(val)) attrs.push(`filter="${val}"`);
        continue;
      }
      if (!ATTRS.has(key) || !SAFE_VALUE.test(val) || /url|script|expression/i.test(val)) continue;
      attrs.push(`${key}="${val}"`);
    }
    const tag = `<${name}${attrs.length ? " " + attrs.join(" ") : ""}`;
    if (selfClose || name !== "g") {
      out.push(`${tag}/>`);
    } else {
      out.push(`${tag}>`);
      stack.push(name);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  const result = out.join("");
  return result.length > maxLength ? "" : result;
}

/** Pull the SVG markup out of a model response (drops code fences and chatter). */
export function extractSvgMarkup(text: string): string {
  const start = text.indexOf("<");
  if (start < 0) return "";
  return text.slice(start).replace(/```[a-z]*\s*/gi, "");
}
