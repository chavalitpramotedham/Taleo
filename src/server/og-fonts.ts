// Fetches Noomi's own brand fonts (Google Fonts) as raw bytes for next/og's
// ImageResponse (Satori), which can't use @font-face/CSS and needs font data
// supplied directly. Cached per server process since the bytes never change.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36";

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchFont(family: string, weight: number, style: "normal" | "italic"): Promise<ArrayBuffer | null> {
  try {
    const ital = style === "italic" ? "1" : "0";
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${ital},${weight}&display=swap`, {
      headers: { "User-Agent": UA },
    }).then((r) => r.text());
    // Google returns one @font-face block per language subset; the block for
    // the requested style that appears last is always the broadest ("latin") one.
    let url: string | null = null;
    for (const block of css.split("}")) {
      if (!block.includes(`font-style: ${style}`)) continue;
      const m = block.match(/url\((https:[^)]+)\)/);
      if (m) url = m[1];
    }
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function loadFont(family: string, weight: number, style: "normal" | "italic" = "normal"): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}:${style}`;
  if (!cache.has(key)) cache.set(key, fetchFont(family, weight, style));
  return cache.get(key)!;
}

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight?: 400 | 700;
  style?: "normal" | "italic";
}

/** Noomi's title serif, small-caps serif and body serif, ready for ImageResponse's `fonts` option. */
export async function loadBrandFonts(): Promise<OgFont[]> {
  const [title, caps, body, bodyItalic] = await Promise.all([
    loadFont("IM Fell English", 400),
    loadFont("IM Fell English SC", 400),
    loadFont("EB Garamond", 400),
    loadFont("EB Garamond", 400, "italic"),
  ]);
  const fonts: OgFont[] = [];
  if (title) fonts.push({ name: "IM Fell English", data: title, weight: 400, style: "normal" });
  if (caps) fonts.push({ name: "IM Fell English SC", data: caps, weight: 400, style: "normal" });
  if (body) fonts.push({ name: "EB Garamond", data: body, weight: 400, style: "normal" });
  if (bodyItalic) fonts.push({ name: "EB Garamond", data: bodyItalic, weight: 400, style: "italic" });
  return fonts;
}
