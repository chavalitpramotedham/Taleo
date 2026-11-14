/**
 * Paintings drawn once, as pictures.
 *
 * A painting is dozens of shapes run through watercolour filters (noise,
 * blur, displacement - see PaintDefs), and a phone works them out again at
 * its full 3x resolution every time any of it is drawn: 2-4 seconds a page
 * on an iPhone, during which the page can't move, and again on every frame
 * of anything moving inside it (a tapped character, the "tap me" hop).
 *
 * Here a painting is drawn once, off the page, at a sensible resolution
 * (watercolour is soft: 1.5-2x the picture's size on screen is plenty), and
 * kept as a picture. Showing a picture is only copying pixels, so pages
 * turn, fade and switch day/night smoothly, and the next pages are drawn
 * ahead, while the current one is read.
 *
 * The tappable character is drawn apart (with what's in front of it drawn
 * apart too), so it can still move on its own when tapped.
 */
import { sanitizeSvg, TARGET_CLASS } from "./svg-sanitize";

/** A drawn layer: a picture (object URL) over the whole 400x300 canvas, or
 *  just `box` of it (in canvas units). */
export type BakedLayer = { url: string; box: { x: number; y: number; w: number; h: number } };
export type Baked = { back: BakedLayer; target?: BakedLayer; front?: BakedLayer };

const W0 = 400;
const H0 = 300;
const SVG_NS = "http://www.w3.org/2000/svg";

/** Pixels across to draw a painting at, for one shown `cssWidth` across:
 *  sharp on the screen it's on - up to 2.25 pixels a point, which on a 3x
 *  iPhone reads as crisp as the painting itself (1.6, tried first, was
 *  plainly soft) - rounded so the same picture at nearly the same size is
 *  drawn once. */
export function bakeWidth(cssWidth: number): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  // (a computer's big picture, seen from further off, at 1.5: drawn at
  // 2.25 it was three times a phone's pixels, and reading it back held
  // the page for most of a second)
  const desk = typeof window !== "undefined" && !window.matchMedia?.("(pointer: coarse)").matches;
  // (a phone at its screen's full density - at 2.25 on a 3x iPhone the
  // picture was stretched by a third and read as soft)
  const density = Math.min(Math.max(dpr, 1), isLowPower() ? 1.75 : desk ? 1.5 : 3);
  const px = Math.max(240, Math.min(desk ? 2200 : 1300, (cssWidth || W0) * density));
  return Math.round(px / 40) * 40;
}

/** The colour a painting is shown over - its own night paper if it has
 *  one showing, else the first coloured background behind it - as
 *  #rrggbb ("" if there's none to be had: then the picture is kept
 *  see-through). */
export function groundOf(el: Element | null): string {
  if (typeof document === "undefined" || !el) return "";
  const paper = el.querySelector?.(".paint-paper");
  const fill = paper ? getComputedStyle(paper).fill : "";
  if (fill && !/^(none|transparent|rgba\(0, 0, 0, 0\))$/.test(fill)) return canonColour(fill);
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(bg)) return /rgba\([^)]*,\s*0?\.\d+\)$/.test(bg) ? "" : canonColour(bg);
  }
  return "";
}
/** A colour written any way, as #rrggbb. */
export const groundOfColour = (c: string) => (typeof document === "undefined" ? "" : canonColour(c));
let colourCtx: CanvasRenderingContext2D | null = null;
function canonColour(c: string): string {
  colourCtx ??= document.createElement("canvas").getContext("2d");
  if (!colourCtx) return "";
  colourCtx.fillStyle = "#000";
  colourCtx.fillStyle = c;
  return String(colourCtx.fillStyle);
}

/** How wide (CSS pixels) a book's pictures were last shown on this device:
 *  a book's first page can be drawn ahead, while its cover is up. */
export function rememberBookWidth(w: number) {
  try {
    localStorage.setItem("taleo.bookw", String(Math.round(w)));
    localStorage.setItem("taleo.bookw.at", String(window.innerWidth));
  } catch {}
}
export function bookWidth(): number {
  try {
    const w = Number(localStorage.getItem("taleo.bookw"));
    // (only if this window is still the size it was: a phone turned on its
    // side shows the pictures at another size)
    const at = Number(localStorage.getItem("taleo.bookw.at"));
    if (w > 100 && at === window.innerWidth) return w;
    // (never seen here yet: on a phone, the picture is the screen's width
    // less the book's margins - 365 on a 390 screen)
    return window.innerWidth < 700 ? window.innerWidth - 25 : 0;
  } catch {
    return 0;
  }
}

/** A phone or computer with little to spare (few cores, little memory, or
 *  asking to save data). Apple's browser doesn't say how many cores or how
 *  much memory it has (an iPhone reports few cores), so it's never judged
 *  by those. */
export function isLowPower(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (n.connection?.saveData) return true;
  if (n.vendor === "Apple Computer, Inc.") return false;
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 3;
}

// ------------------------------------------------------------------ cache

type Entry = { promise: Promise<Baked | null>; value?: Baked | null; urls: string[] };
const cache = new Map<string, Entry>();
// (a drawing is about 1MB - Safari saves PNG, the washes being see-through -
// so a few books' worth, not more)
const CACHE_MAX = 18;

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}-${s.length}`;
}

const keyOf = (clean: string, width: number, night: boolean, split: boolean, ground = "") => `${hash(clean)}|${width}|${ground}|${night ? "n" : "d"}|${split ? "s" : "w"}`;

/** This painting has been drawn already (at any size): it can be put up
 *  at once. */
export function hasDrawing(clean: string, night: boolean): boolean {
  if (!clean || !canBake()) return false;
  const head = `${hash(clean)}|`;
  const tail = `|${night ? "n" : "d"}|s`;
  for (const [k, e] of cache) if (k.startsWith(head) && k.endsWith(tail) && e.value) return true;
  return false;
}

/** Already drawn: the pictures, at once (so a copy of a page - the turning
 *  leaf - shows them on its very first frame). */
export function peekBaked(clean: string, width: number, night: boolean, split = true, ground = ""): Baked | null | undefined {
  const e = cache.get(keyOf(clean, width, night, split, ground));
  if (e) touch(keyOf(clean, width, night, split, ground), e);
  return e?.value;
}

function touch(key: string, e: Entry) {
  cache.delete(key);
  cache.set(key, e);
}

function evict() {
  while (cache.size > CACHE_MAX) {
    const [k, e] = cache.entries().next().value as [string, Entry];
    cache.delete(k);
    // (a little later: a page still on show keeps its decoded pictures,
    // but one being put up right now may still need its address)
    window.setTimeout(() => e.urls.forEach((u) => URL.revokeObjectURL(u)), 60_000);
  }
}

/** Draw a painting (sanitized markup) as pictures, or get the drawing
 *  already made or under way. `soon` puts it ahead of drawings for later
 *  pages. Null if it can't be drawn this way (the page then shows the
 *  painting itself). */
export function bakePainting(clean: string, opts: { width: number; night: boolean; split?: boolean; soon?: boolean; ground?: string }): Promise<Baked | null> {
  const split = opts.split ?? true;
  const key = keyOf(clean, opts.width, opts.night, split, opts.ground);
  const hit = cache.get(key);
  if (hit) {
    touch(key, hit);
    if (opts.soon) hurry(key);
    return hit.promise;
  }
  const entry: Entry = { promise: Promise.resolve(null), urls: [] };
  entry.promise = (async () => (await fromStore(key, entry.urls)) ?? enqueue(key, Boolean(opts.soon), (pause) => draw(clean, opts.width, opts.night, split, entry.urls, pause, opts.ground)))().then(
    (v) => ((entry.value = v), v),
    () => ((entry.value = null), null),
  );
  cache.set(key, entry);
  evict();
  return entry.promise;
}

/** Draw a painting ahead, in a quiet moment (the next page while this one
 *  is read). */
export function prebake(clean: string, opts: { width: number; night: boolean; ground?: string }) {
  if (!clean || !canBake()) return;
  void bakePainting(clean, { ...opts, soon: false });
}

// ------------------------------------------------------------------ queue
// One drawing at a time (each holds the page up while it's drawn): what's
// needed now first, then what's wanted later, each in a quiet moment.

type Job = { key: string; soon: boolean; run: (pause: () => Promise<void>) => Promise<Baked | null>; done: (v: Baked | null) => void; fail: (e: unknown) => void };
const queue: Job[] = [];
let busy = false;

function enqueue(key: string, soon: boolean, run: (pause: () => Promise<void>) => Promise<Baked | null>): Promise<Baked | null> {
  return new Promise((done, fail) => {
    queue.push({ key, soon, run, done, fail });
    pump();
  });
}

function hurry(key: string) {
  const j = queue.find((q) => q.key === key);
  if (j) j.soon = true;
}

function pump() {
  if (busy || !queue.length) return;
  const i = queue.findIndex((j) => j.soon);
  const job = queue.splice(i >= 0 ? i : 0, 1)[0];
  busy = true;
  // Between the layers of a drawing, the page gets a frame (and, for a
  // drawing only wanted later, waits for a quiet moment).
  const pause = () =>
    new Promise<void>((r) => {
      // (never waiting on a frame alone: a page out of sight draws none)
      const t = window.setTimeout(r, 120);
      const go = () => (window.clearTimeout(t), window.setTimeout(r, 0));
      if (job.soon) requestAnimationFrame(go);
      else (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 60)))(go, { timeout: 800 });
    });
  const go = () =>
    job
      .run(pause)
      .then(job.done, job.fail)
      .finally(() => {
        busy = false;
        // (a frame between drawings, however many are waiting)
        window.setTimeout(pump, 16);
      });
  if (job.soon) go();
  else {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    ric(() => go(), { timeout: 1500 });
  }
}

// ------------------------------------------------------------------ drawing

let support: boolean | null = null;
/** Paintings are drawn as pictures here: on Apple's browser engine (Safari,
 *  and every browser on an iPhone or iPad), which works out a page's
 *  painting while the page waits - seconds on a phone. Chrome works it out
 *  on the side, without holding the page up, so there the painting is
 *  simply shown. (localStorage "taleo.bake" = "1" or "0" overrides, for
 *  trying either way.) */
export function canBake(): boolean {
  if (support !== null) return support;
  const works = typeof document !== "undefined" && typeof Image !== "undefined" && typeof URL?.createObjectURL === "function" && Boolean(document.createElement("canvas").getContext);
  let asked: string | null = null;
  try {
    asked = localStorage.getItem("taleo.bake");
  } catch {}
  const apple = typeof navigator !== "undefined" && navigator.vendor === "Apple Computer, Inc.";
  support = works && (asked === "1" || (asked !== "0" && apple));
  return support;
}

let defsMarkup: string | null = null;
let defsNight: boolean | null = null;
/** The paint box (PaintDefs) as markup for a standalone picture, with the
 *  page's night paper colour written in (a picture can't see the page's
 *  colours). */
function defs(night: boolean): string | null {
  if (defsMarkup === null || defsNight !== night) {
    const box = document.getElementById("tl-wash")?.closest("svg");
    if (!box) return null;
    const reserve = getComputedStyle(document.documentElement).getPropertyValue("--paint-reserve").trim() || "#FBF7EE";
    defsMarkup = box.innerHTML.replace(/var\(--paint-reserve[^)]*\)/g, reserve);
    defsNight = night;
  }
  return defsMarkup;
}

// ------------------------------------------------------------------ kept
// Drawings are kept on the device (the browser's Cache Storage), so a book
// read before - or a page turned back to after a reload - is never drawn
// again: its pictures are just read back.

const STORE = "taleo-paintings-v2";
const STORE_MAX = 48;
const storeUrl = (key: string, part: string) => `/__painted/${encodeURIComponent(key)}/${part}`;

async function fromStore(key: string, urls: string[]): Promise<Baked | null> {
  if (typeof caches === "undefined") return null;
  try {
    const c = await caches.open(STORE);
    const meta = await c.match(storeUrl(key, "meta"));
    if (!meta) return null;
    const m = (await meta.json()) as { name: "back" | "target" | "front"; box: BakedLayer["box"] }[];
    const out: Partial<Baked> = {};
    for (const l of m) {
      const r = await c.match(storeUrl(key, l.name));
      if (!r) return null;
      const url = URL.createObjectURL(await r.blob());
      urls.push(url);
      out[l.name] = { url, box: l.box };
    }
    return out.back ? (out as Baked) : null;
  } catch {
    return null;
  }
}

async function toStore(key: string, b: Baked) {
  if (typeof caches === "undefined") return;
  try {
    const c = await caches.open(STORE);
    const layers = (["back", "target", "front"] as const).flatMap((name) => {
      const l = b[name] as (BakedLayer & { blob?: Blob }) | undefined;
      return l?.blob ? [{ name, box: l.box, blob: l.blob }] : [];
    });
    if (!layers.length) return;
    for (const l of layers) await c.put(storeUrl(key, l.name), new Response(l.blob, { headers: { "content-type": l.blob.type } }));
    await c.put(storeUrl(key, "meta"), new Response(JSON.stringify(layers.map(({ name, box }) => ({ name, box }))), { headers: { "content-type": "application/json" } }));
    // (the oldest drawings make room, now and then)
    if (Math.random() < 0.25) {
      const metas = (await c.keys()).filter((r) => r.url.endsWith("/meta"));
      for (const r of metas.slice(0, Math.max(0, metas.length - STORE_MAX))) {
        const base = r.url.slice(0, -"meta".length);
        await Promise.all(["meta", "back", "target", "front"].map((p) => c.delete(base + p)));
      }
    }
  } catch {}
}

async function draw(clean: string, width: number, night: boolean, split: boolean, urls: string[], pause: () => Promise<void>, ground = ""): Promise<Baked | null> {
  const d = defs(night);
  if (!d || !canBake()) return null;
  const key = keyOf(clean, width, night, split, ground);
  const made = await drawFresh(d, clean, width, split, urls, pause, ground);
  if (made) void toStore(key, made);
  return made;
}

async function drawFresh(d: string, clean: string, width: number, split: boolean, urls: string[], pause: () => Promise<void>, ground = ""): Promise<Baked | null> {
  const parts = split ? splitAtTarget(clean) : null;
  const height = Math.round((width * H0) / W0);
  if (!parts) {
    const back = await layer(d, clean, width, height, false, urls, pause, ground);
    return back ? { back } : null;
  }
  const back = await layer(d, parts.back, width, height, false, urls, pause, ground);
  if (!back) return null;
  // (a frame let through between layers)
  await pause();
  const target = parts.target ? await layer(d, parts.target, width, height, true, urls) : null;
  await pause();
  const front = parts.front ? await layer(d, parts.front, width, height, true, urls) : null;
  return { back, ...(target ? { target } : {}), ...(front ? { front } : {}) };
}

/** One layer drawn to a picture: the whole canvas, or (`crop`) only the
 *  part with something on it. Drawn in one go: Safari works out a picture's
 *  watercolour filters over the whole of it however little of it is drawn,
 *  so drawing it in strips (tried first) cost a whole drawing per strip. */
async function layer(defsInner: string, content: string, width: number, height: number, crop: boolean, urls: string[], pause?: () => Promise<void>, ground = ""): Promise<BakedLayer | null> {
  // (a layer with only part of the picture on it - the tappable character,
  // what's in front of it - is drawn at just its own size: its box is
  // measured from its shapes, never read back from the drawing, which made
  // the page wait while the drawing was finished)
  let box = { x: 0, y: 0, w: W0, h: H0 };
  if (crop) {
    const b = shapesBox(content);
    if (!b) return null;
    box = b;
  }
  const k = width / W0;
  const pw = Math.max(1, Math.round(box.w * k));
  const ph = Math.max(1, Math.round(box.h * k));
  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // (the whole picture is laid on the colour it's shown over - the page by
  // day, the lamplit paper at night - so it can be kept as a JPEG: Safari
  // takes a third of a second to save a see-through PNG of a phone-sharp
  // painting, holding the page all the while; a JPEG takes a moment)
  const opaque = Boolean(ground && !crop);
  if (opaque) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, pw, ph);
  }
  // (in a few batches of shapes, a frame let through between: each shape's
  // watercolour is its own, so batches drawn one over another make the
  // very same picture - unlike strips, each batch costs only its own share)
  const batches = pause ? inBatches(content, 4) : [content];
  try {
    for (let i = 0; i < batches.length; i++) {
      const whole = `<svg xmlns="${SVG_NS}" width="${pw}" height="${ph}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${defsInner}${batches[i]}</svg>`;
      const src = URL.createObjectURL(new Blob([whole], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        img.src = src;
        await img.decode();
        ctx.drawImage(img, 0, 0, pw, ph);
      } finally {
        URL.revokeObjectURL(src);
      }
      if (pause && i < batches.length - 1) await pause();
    }
    const blob = await saveCanvas(canvas, opaque);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return { url, box, blob } as BakedLayer & { blob: Blob };
  } catch {
    return null;
  }
}

/** Where a layer's shapes lie on the 400x300 canvas, with room round them
 *  for the watercolour's soft, wobbly edges - measured by laying them out
 *  in a hidden picture (no painting). Null if there's nothing there. */
function shapesBox(content: string): BakedLayer["box"] | null {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "400");
  svg.setAttribute("height", "300");
  svg.setAttribute("viewBox", `0 0 ${W0} ${H0}`);
  svg.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none";
  const g = document.createElementNS(SVG_NS, "g");
  g.innerHTML = content;
  svg.appendChild(g);
  document.body.appendChild(svg);
  try {
    const r = g.getBBox();
    if (!r.width || !r.height) return null;
    const m = 14;
    const x = Math.max(0, Math.floor(r.x - m));
    const y = Math.max(0, Math.floor(r.y - m));
    const x1 = Math.min(W0, Math.ceil(r.x + r.width + m));
    const y1 = Math.min(H0, Math.ceil(r.y + r.height + m));
    return x1 > x && y1 > y ? { x, y, w: x1 - x, h: y1 - y } : null;
  } catch {
    return null;
  } finally {
    svg.remove();
  }
}

/**
 * A painting's markup in about `n` batches of whole shapes, in their order,
 * each wrapped in the groups it sits in. A group is only ever split if
 * splitting it changes nothing: one with its own filter, opacity, mask or
 * clip is kept whole (its effect is on the group together).
 */
function inBatches(content: string, n: number): string[] {
  const root = document.createElementNS(SVG_NS, "g");
  root.innerHTML = content;
  const total = content.length;
  const most = Math.max(2000, total / n);
  const whole = (el: Element) => ["filter", "opacity", "mask", "clip-path", "style"].some((a) => el.hasAttribute(a));
  const tags = new Map<Element, string>();
  // (a group's own opening tag, from a copy without its contents)
  const openTag = (g: Element) => {
    let t = tags.get(g);
    if (t === undefined) {
      const bare = (g.cloneNode(false) as Element).outerHTML;
      t = bare.endsWith("/>") ? bare.slice(0, -2) + ">" : bare.slice(0, bare.lastIndexOf("</g>"));
      tags.set(g, t);
    }
    return t;
  };
  // (the units: shapes, or groups kept whole, each with the groups around it)
  const units: { html: string; wrap: Element[] }[] = [];
  const walk = (el: Element, wrap: Element[]) => {
    for (const c of [...el.children]) {
      if (c.tagName.toLowerCase() === "g" && !whole(c) && c.outerHTML.length > most / 2) walk(c, [...wrap, c]);
      else units.push({ html: c.outerHTML, wrap });
    }
  };
  walk(root, []);
  if (units.length < 2) return [content];
  // (packed into batches of about the same size)
  const batches: string[] = [];
  let cur: typeof units = [];
  let size = 0;
  const flush = () => {
    if (!cur.length) return;
    batches.push(cur.map((u) => u.wrap.reduceRight((inner, g) => openTag(g) + inner + "</g>", u.html)).join(""));
    cur = [];
    size = 0;
  };
  for (const u of units) {
    if (size + u.html.length > most && cur.length) flush();
    cur.push(u);
    size += u.html.length;
  }
  flush();
  return batches;
}

function saveCanvas(c: HTMLCanvasElement, opaque = false): Promise<Blob | null> {
  if (opaque) return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  return new Promise((r) =>
    c.toBlob(
      (b) => {
        // (WebP where the browser writes it - smaller, quicker to show)
        if (b) r(b);
        else c.toBlob(r, "image/png");
      },
      "image/webp",
      0.92,
    ),
  );
}

/** The painting in three: everything drawn before the tappable group, the
 *  group itself, and everything drawn after it (in front of it). Null when
 *  there's no tappable group with anything in it. */
function splitAtTarget(clean: string): { back: string; target: string | null; front: string | null } | null {
  const root = document.createElementNS(SVG_NS, "g");
  root.innerHTML = clean;
  const all = [...root.querySelectorAll(`.${TARGET_CLASS}`)];
  const target = all.find((el) => el.childElementCount > 0);
  if (!target) return null;
  const path: number[] = [];
  for (let n: Element = target; n !== root; n = n.parentElement!) path.unshift([...n.parentElement!.children].indexOf(n));
  const find = (r: Element) => path.reduce<Element>((el, i) => el.children[i], r);

  const back = root.cloneNode(true) as Element;
  {
    const t = find(back);
    for (let n: Element = t; n !== back; n = n.parentElement!) while (n.nextElementSibling) n.nextElementSibling.remove();
    t.remove();
  }
  const only = root.cloneNode(true) as Element;
  {
    const t = find(only);
    for (let n: Element = t; n !== only; n = n.parentElement!) {
      while (n.nextElementSibling) n.nextElementSibling.remove();
      while (n.previousElementSibling) n.previousElementSibling.remove();
    }
    // (the group's own class would be styled by nothing here; harmless)
  }
  const front = root.cloneNode(true) as Element;
  {
    const t = find(front);
    for (let n: Element = t; n !== front; n = n.parentElement!) while (n.previousElementSibling) n.previousElementSibling.remove();
    t.remove();
  }
  const shapes = (el: Element) => el.querySelector("path,circle,ellipse,rect,polygon,polyline,line") !== null;
  return { back: back.innerHTML, target: shapes(only) ? only.innerHTML : null, front: shapes(front) ? front.innerHTML : null };
}

// (development only: the drawing step, to try by hand)
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __bakeDebug?: unknown }).__bakeDebug = {
    bake: (svg: string, width: number, ground = "#fbf7ee") => bakePainting(sanitizeSvg(svg), { width, night: document.documentElement.dataset.night === "1", soon: true, ground }),
    split: (svg: string) => splitAtTarget(sanitizeSvg(svg)),
    layer: async (svg: string, width: number) => {
      const urls: string[] = [];
      const d = defs(document.documentElement.dataset.night === "1");
      try {
        return { d: Boolean(d), r: await layer(d!, sanitizeSvg(svg), width, Math.round((width * 3) / 4), false, urls) };
      } catch (e) {
        return { err: String(e) };
      }
    },
  };
}
