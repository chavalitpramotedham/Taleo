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
import { TARGET_CLASS } from "./svg-sanitize";

/** A drawn layer: a picture (object URL) over the whole 400x300 canvas, or
 *  just `box` of it (in canvas units). */
export type BakedLayer = { url: string; box: { x: number; y: number; w: number; h: number } };
export type Baked = { back: BakedLayer; target?: BakedLayer; front?: BakedLayer };

const W0 = 400;
const H0 = 300;
const SVG_NS = "http://www.w3.org/2000/svg";

/** Pixels across to draw a painting at, for one shown `cssWidth` across:
 *  sharp on the screen it's on - up to 2.5 pixels a point, which on a 3x
 *  iPhone reads as crisp as the painting itself (1.6, tried first, was
 *  plainly soft) - rounded so the same picture at nearly the same size is
 *  drawn once. */
export function bakeWidth(cssWidth: number): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const density = Math.min(Math.max(dpr, 1), isLowPower() ? 1.75 : 2.5);
  const px = Math.max(240, Math.min(2200, (cssWidth || W0) * density));
  return Math.round(px / 40) * 40;
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
const CACHE_MAX = 28;

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}-${s.length}`;
}

const keyOf = (clean: string, width: number, night: boolean, split: boolean) => `${hash(clean)}|${width}|${night ? "n" : "d"}|${split ? "s" : "w"}`;

/** Already drawn: the pictures, at once (so a copy of a page - the turning
 *  leaf - shows them on its very first frame). */
export function peekBaked(clean: string, width: number, night: boolean, split = true): Baked | null | undefined {
  const e = cache.get(keyOf(clean, width, night, split));
  if (e) touch(keyOf(clean, width, night, split), e);
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
export function bakePainting(clean: string, opts: { width: number; night: boolean; split?: boolean; soon?: boolean }): Promise<Baked | null> {
  const split = opts.split ?? true;
  const key = keyOf(clean, opts.width, opts.night, split);
  const hit = cache.get(key);
  if (hit) {
    touch(key, hit);
    if (opts.soon) hurry(key);
    return hit.promise;
  }
  const entry: Entry = { promise: Promise.resolve(null), urls: [] };
  entry.promise = enqueue(key, Boolean(opts.soon), (pause) => draw(clean, opts.width, opts.night, split, entry.urls, pause)).then(
    (v) => ((entry.value = v), v),
    () => ((entry.value = null), null),
  );
  cache.set(key, entry);
  evict();
  return entry.promise;
}

/** Draw a painting ahead, in a quiet moment (the next page while this one
 *  is read). */
export function prebake(clean: string, opts: { width: number; night: boolean }) {
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
  // Between strips of a drawing, the page gets a frame (and, for a drawing
  // only wanted later, waits for a quiet moment), so drawing never holds
  // it up for long.
  const pause = () =>
    new Promise<void>((r) => {
      if (job.soon) requestAnimationFrame(() => window.setTimeout(r, 0));
      else (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 60)))(() => r(), { timeout: 800 });
    });
  const go = () =>
    job
      .run(pause)
      .then(job.done, job.fail)
      .finally(() => {
        busy = false;
        pump();
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
  // (off for everyone for now: on an iPhone, at full sharpness, pictures
  // never appeared - not yet tried in Safari itself. "taleo.bake" = "1"
  // turns it on to try.)
  support = works && asked === "1";
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

async function draw(clean: string, width: number, night: boolean, split: boolean, urls: string[], pause: () => Promise<void>): Promise<Baked | null> {
  const d = defs(night);
  if (!d || !canBake()) return null;
  const parts = split ? splitAtTarget(clean) : null;
  const height = Math.round((width * H0) / W0);
  if (!parts) {
    const back = await layer(d, clean, width, height, false, urls, pause);
    return back ? { back } : null;
  }
  const back = await layer(d, parts.back, width, height, false, urls, pause);
  if (!back) return null;
  const target = parts.target ? await layer(d, parts.target, width, height, true, urls, pause) : null;
  const front = parts.front ? await layer(d, parts.front, width, height, true, urls, pause) : null;
  return { back, ...(target ? { target } : {}), ...(front ? { front } : {}) };
}

/** One layer drawn to a picture: the whole canvas, or (`crop`) only the
 *  part with something on it. Drawn in strips across, a frame let through
 *  between each: the watercolour filters are worked out strip by strip
 *  (the browser only works out what each strip shows), so the page is
 *  never held up for more than a moment. */
async function layer(defsInner: string, content: string, width: number, height: number, crop: boolean, urls: string[], pause: () => Promise<void>): Promise<BakedLayer | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const n = Math.max(3, Math.min(14, Math.round(height / 56)));
  try {
    for (let i = 0; i < n; i++) {
      const y0 = Math.round((i * height) / n);
      const y1 = Math.round(((i + 1) * height) / n);
      const vy = (y0 * H0) / height;
      const vh = ((y1 - y0) * H0) / height;
      const strip = `<svg xmlns="${SVG_NS}" width="${width}" height="${y1 - y0}" viewBox="0 ${vy} ${W0} ${vh}" preserveAspectRatio="none">${defsInner}${content}</svg>`;
      const src = URL.createObjectURL(new Blob([strip], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        img.src = src;
        await img.decode();
        // (the slow part: this strip's watercolour worked out, once)
        ctx.drawImage(img, 0, y0, width, y1 - y0);
      } finally {
        URL.revokeObjectURL(src);
      }
      await pause();
    }
    let box = { x: 0, y: 0, w: W0, h: H0 };
    let out: HTMLCanvasElement = canvas;
    if (crop) {
      const b = opaqueBox(ctx, width, height);
      if (!b) return null;
      const c2 = document.createElement("canvas");
      c2.width = b.w;
      c2.height = b.h;
      c2.getContext("2d")!.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      out = c2;
      const k = W0 / width;
      box = { x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k };
    }
    const blob = await saveCanvas(out);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return { url, box };
  } catch {
    return null;
  }
}

function saveCanvas(c: HTMLCanvasElement): Promise<Blob | null> {
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

/** The part of a drawn layer with paint on it (a small margin around). */
function opaqueBox(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  // (every other pixel each way is plenty to find the edges)
  for (let y = 0; y < h; y += 2) {
    const row = y * w * 4;
    for (let x = 0; x < w; x += 2) {
      if (data[row + x * 4 + 3] > 6) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = 3;
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(w - 1, x1 + m);
  y1 = Math.min(h - 1, y1 + m);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
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
