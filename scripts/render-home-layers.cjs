/**
 * Pre-paints the homepage's sample scene into still image layers, so the
 * "painting before your eyes" animation only has to fade finished pictures
 * in (GPU work) instead of re-running the watercolour filters across the
 * whole scene on every frame.
 *
 * Each top-level part of HOME_SCENE (src/lib/art/homeScene.ts: washes,
 * painted shapes, details) is rendered on its own, with the site's real
 * paint filters, to a transparent WebP in public/art/home/ - cut down to
 * just the part of the sheet it paints on (a character's layer is the size
 * of the character, not of the whole picture: less to download, and far
 * less for the phone's graphics memory to hold and blend). Pen-line parts
 * stay as live SVG (they draw on stroke by stroke). The list, with where
 * each image sits on the sheet, is written to src/lib/art/homeLayers.ts.
 *
 * The images are named by what's in them, so a changed painting is never
 * mistaken for the copy a browser has kept (they're kept for a week).
 *
 * Re-run after changing HOME_SCENE or the paint filters:
 *   npm run build && npx next start     (or npm run dev, in another terminal)
 *   node scripts/render-home-layers.cjs [http://localhost:3000]
 * Needs Playwright (or playwright-core with Google Chrome installed).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BASE = process.argv[2] || "http://localhost:3000";
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/art/home");
const W = 880; // 2.2x the 400x300 canvas: sharp on retina at the homepage's size
const H = 660;
const QUALITY = 0.8;
const PAD = 6; // px of clear paper kept round each cut-out
// The washes (sky, land, water, the tree's crown) are soft, blurred colour
// across the whole sheet: kept at half the size they lose nothing the eye
// can find, and are a quarter of the pixels to download, hold and blend.
const WASH_SCALE = 0.5;

async function launch() {
  try {
    return await require("playwright").chromium.launch();
  } catch {
    return require("playwright-core").chromium.launch({ channel: "chrome", headless: true });
  }
}

(async () => {
  const source = fs.readFileSync(path.join(ROOT, "src/lib/art/homeScene.ts"), "utf8");
  const scene = source.slice(source.indexOf("`") + 1, source.lastIndexOf("`"));

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("#tl-wash", { state: "attached" });
  // The shared paint filters, as the site defines them.
  const defs = await page.evaluate(() => document.querySelector("#tl-wash").closest("svg").outerHTML);

  // The scene's top-level parts.
  const shot = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const frame = (inner) =>
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}` +
    `.wash{filter:url(#tl-wash)}.paint{filter:url(#tl-paint)}.ink{filter:url(#tl-ink)}</style></head><body>${defs}` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="${W}" height="${H}">${inner}</svg></body></html>`;
  await shot.setContent(frame(scene));
  const parts = await shot.evaluate(() =>
    Array.from(document.querySelectorAll("body > svg:last-of-type > g")).map((g) => {
      const kind = ["wash", "paint", "ink", "detail"].find((k) => g.classList.contains(k)) || "detail";
      const clone = g.cloneNode(true);
      const name = clone.getAttribute("data-name") || "";
      clone.removeAttribute("data-name");
      if (kind === "ink") {
        // (drawn on live: the page's own styles filter it, and each line
        // is measured as 1 long so one dash can draw any of them)
        clone.removeAttribute("class");
        clone.setAttribute("filter", "url(#tl-ink)");
        clone.querySelectorAll("*").forEach((p) => p.setAttribute("pathLength", "1"));
      }
      return { kind, name, markup: clone.outerHTML };
    }),
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) if (/^(layer-|l\d)/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));

  const layers = [];
  let total = 0;
  let area = 0;
  for (let i = 0; i < parts.length; i++) {
    const { kind, name, markup } = parts[i];
    if (kind === "ink") {
      layers.push({ kind, name, svg: markup });
      continue;
    }
    await shot.setContent(frame(markup));
    const png = await shot.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
    // Cut down to what was painted, then PNG -> WebP (with alpha) using
    // the browser's own encoder.
    const out = await shot.evaluate(
      async ({ b64, q, pad, scale }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++)
            if (px[(y * c.width + x) * 4 + 3] > 2) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
        if (x1 < 0) return null;
        x0 = Math.max(0, x0 - pad);
        y0 = Math.max(0, y0 - pad);
        x1 = Math.min(c.width - 1, x1 + pad);
        y1 = Math.min(c.height - 1, y1 + pad);
        const cut = document.createElement("canvas");
        const w = x1 - x0 + 1;
        const h = y1 - y0 + 1;
        cut.width = Math.round(w * scale);
        cut.height = Math.round(h * scale);
        const to = cut.getContext("2d");
        to.imageSmoothingQuality = "high";
        to.drawImage(c, x0, y0, w, h, 0, 0, cut.width, cut.height);
        return { webp: cut.toDataURL("image/webp", q).split(",")[1], x: x0, y: y0, w, h, pw: cut.width, ph: cut.height };
      },
      { b64: png.toString("base64"), q: QUALITY, pad: PAD, scale: kind === "wash" ? WASH_SCALE : 1 },
    );
    if (!out) continue;
    const bytes = Buffer.from(out.webp, "base64");
    const file = `l${String(i).padStart(2, "0")}-${crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 8)}.webp`;
    fs.writeFileSync(path.join(OUT_DIR, file), bytes);
    const pct = (v, of) => Math.round((v / of) * 100000) / 1000;
    layers.push({ kind, name, src: `/art/home/${file}`, box: [pct(out.x, W), pct(out.y, H), pct(out.w, W), pct(out.h, H)], px: [out.pw, out.ph] });
    total += bytes.length;
    area += out.pw * out.ph;
    console.log(file.padEnd(22), kind.padEnd(6), name.padEnd(18), `${out.pw}x${out.ph}`.padEnd(9), Math.round(bytes.length / 1024) + "KB");
  }
  await browser.close();

  const ts =
    `// Generated by scripts/render-home-layers.cjs from HOME_SCENE - don't edit by hand.\n` +
    `// The homepage painting's parts in paint order: pre-painted images (each\n` +
    `// cut down to where it paints: \`box\` is its left, top, width and height\n` +
    `// in % of the sheet, \`px\` its size in pixels), and pen lines kept as live\n` +
    `// SVG so they can draw on.\n` +
    `export type HomeLayer =\n` +
    `  | { kind: "wash" | "paint" | "detail"; name: string; src: string; box: [number, number, number, number]; px: [number, number] }\n` +
    `  | { kind: "ink"; name: string; svg: string };\n\n` +
    `export const HOME_LAYERS: HomeLayer[] = ${JSON.stringify(layers, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, "src/lib/art/homeLayers.ts"), ts);
  const images = layers.filter((l) => l.kind !== "ink").length;
  console.log(`wrote ${layers.length} layers (${images} images, ${Math.round(total / 1024)}KB; ${Math.round((area / (W * H * images)) * 100)}% of the pixels full-sheet layers would hold)`);
})();
