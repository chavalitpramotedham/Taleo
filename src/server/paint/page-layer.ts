import type { Light, Season } from "@/lib/art/palette";
import { hashOf, seeded } from "@/lib/art/stamps";

/**
 * A page's own sky and foreground, made in code rather than painted: the
 * few things that make a reused backdrop feel like a fresh moment - clouds
 * that have drifted, a bird or two, the weather, the season's leaves, a
 * fringe of grass and flowers along the bottom. Written as the expander's
 * placeholders (see expand), so it comes out in the house style.
 *
 * Indoors it adds nothing: a room doesn't change from page to page.
 */
const INDOORS = /\b(inside|indoors|room|kitchen|bedroom|bathroom|hall|attic|cellar|classroom|library|shop|nursery|den|burrow)\b/i;

export function codePageLayer(o: { place: string; picture: string; light: Light; season: Season; seed: string }): string {
  if (INDOORS.test(o.place)) return "";
  const r = seeded(hashOf(`layer:${o.seed}`));
  const pick = (lo: number, hi: number) => Math.round(lo + r() * (hi - lo));
  const out: string[] = [];
  const night = o.light === "night";
  if (night) {
    out.push(`<scatter k="stars" x="0" y="0" w="400" h="120" n="${pick(14, 24)}"/>`);
  } else {
    // (one or two clouds, somewhere new on every page)
    for (let i = 0, n = pick(1, 2); i < n; i++) out.push(`<stamp k="cloud" x="${i === 0 ? pick(40, 160) : pick(240, 360)}" y="${pick(30, 70)}" s="${(0.6 + r() * 0.5).toFixed(2)}"${r() < 0.5 ? ' flip="1"' : ""}/>`);
    if (o.light !== "rain" && r() < 0.7) for (let i = 0, n = pick(1, 3); i < n; i++) out.push(`<stamp k="bird" x="${pick(60, 340)}" y="${pick(40, 95)}" s="${(0.8 + r() * 0.5).toFixed(2)}"/>`);
  }
  if (o.light === "rain" || /\brain/i.test(o.picture)) out.push(`<scatter k="rain" x="0" y="0" w="400" h="290" n="${pick(40, 60)}"/>`);
  else if (o.season === "winter" && /\bsnow/i.test(`${o.place} ${o.picture}`)) out.push(`<scatter k="snow" x="0" y="0" w="400" h="290" n="${pick(30, 45)}"/>`);
  if (o.season === "autumn" || /\bleaves\b/i.test(o.picture)) out.push(`<scatter k="leaves" x="20" y="120" w="360" h="150" n="${pick(5, 9)}"/>`);
  else if (!night && r() < 0.5) out.push(`<stamp k="butterfly" x="${r() < 0.5 ? pick(30, 90) : pick(310, 370)}" y="${pick(105, 140)}" s="1"/>`);
  // (the foreground fringe, left and right of the characters)
  out.push(`<scatter k="grass" x="0" y="262" w="400" h="28" n="${pick(8, 12)}"/>`);
  if (!night && o.season !== "winter") out.push(`<scatter k="flowers" x="0" y="258" w="400" h="30" n="${pick(6, 12)}"/>`);
  return out.join("");
}
