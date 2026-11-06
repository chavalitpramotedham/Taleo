// Whitelist sanitizer for model-drawn SVG fragments. It rebuilds markup from
// scratch, keeping only simple shape elements and presentation attributes, so
// nothing executable (scripts, event handlers, links, foreignObject…) survives.
// Used on the server when art is generated and again on the client before
// rendering (shared links are untrusted input).

const TAGS = new Set(["g", "path", "circle", "ellipse", "rect", "polygon", "polyline", "line"]);
const ATTRS = new Set([
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2",
  "points", "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap",
  "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "transform", "fill-rule",
]);
const SAFE_VALUE = /^[#a-zA-Z0-9\s.,\-+()%]*$/;

export function sanitizeSvg(input: string | null | undefined, maxLength = 20000): string {
  if (!input) return "";
  const src = input.slice(0, maxLength * 2).replace(/<!--[\s\S]*?-->/g, "");
  const out: string[] = [];
  const stack: string[] = [];
  const tagRe = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/)?\s*>/g;
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
