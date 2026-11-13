import type { CharacterDef } from "@/lib/types";
import type { Sprite, SpritePose } from "@/lib/art/sprites";
import { hashOf } from "@/lib/art/stamps";
import { metricsEnabled, pipeline } from "../metrics";
import { kept, once } from "./once";
import { keepGoing, prepareParts } from "./parts-maker";
import { prepareSprite } from "./sprite-maker";

/**
 * Newcomers made ready for reuse.
 *
 * A newcomer - a character the story brings in with no portrait (a
 * squirrel, an alien) - is painted for the page it's on. Its FIRST
 * painting is kept as its portrait for the book. From then on it is like
 * any other character:
 * - later pages paint it from that portrait, so it stays the same
 *   character (same colours, markings, shape) instead of a new guess from
 *   the words each time;
 * - its parts are made at once, in the background (cheap: one call), so
 *   way 4 places it like anyone else from its next page on;
 * - once it comes back (its second page in the book), its core poses are
 *   prepared too, in the background, so way 5 places it without painting.
 *   (A one-off walk-on isn't worth its poses; a recurring one is.)
 * A story's new characters can be readied the moment they're introduced,
 * before any page is painted (see readyNewcomer).
 */

/** The poses prepared for a recurring newcomer: the ones most pages need
 *  (eight of the sixteen; the rest are painted for the page as needed). */
export const NEWCOMER_POSES: SpritePose[] = ["stand", "walk", "wave", "point", "sit", "surprised", "laugh", "hold"];

/** Where a newcomer's portrait is kept: by book, name and description (on
 *  the bench, each variant keeps its own, so none paints for another). */
const portraitKey = (c: Pick<CharacterDef, "name" | "look">, book: string, benchVariant?: string) =>
  `nc:v1:${hashOf(`${book}|${c.name.trim().toLowerCase()}|${c.look.trim()}`)}${benchVariant ? `:bench:${benchVariant}` : ""}`;

/** A pose's layers as a 200x200 portrait painting. */
export const portraitOf = (sp: Sprite) =>
  `<g class="paint">${sp.paint}</g><g class="ink" fill="none" stroke="#4F3A2A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${sp.ink}</g><g class="detail">${sp.detail}</g>`;

/** A newcomer's kept portrait, if it has one in this book. */
export async function newcomerPortrait(c: Pick<CharacterDef, "name" | "look">, book: string, benchVariant?: string): Promise<string | null> {
  if (!c.name || !book) return null;
  return kept<string>(portraitKey(c, book, benchVariant)).catch(() => null);
}

/** Keeps a newcomer's first painting as its portrait for the book, and
 *  starts making it ready for reuse (see above). Counts its appearances: on
 *  its second, its core poses are prepared. Never waits on the preparing. */
export async function keepNewcomer(c: CharacterDef, painting: Sprite, book: string, benchVariant?: string): Promise<void> {
  if (!c.name || !book) return;
  const key = portraitKey(c, book, benchVariant);
  const svg = (await once(key, async () => portraitOf(painting), { ttlS: 180 * 86_400, waitMs: 5_000 }).catch(() => null)) ?? portraitOf(painting);
  readyForReuse({ ...c, preset: null, svg }, key);
}

/** One more appearance of a newcomer that has its portrait: its parts are
 *  made if they aren't, and on its second appearance its poses too. */
export function sawNewcomerAgain(c: CharacterDef, book: string, benchVariant?: string): void {
  if (!c.svg) return;
  readyForReuse(c, portraitKey(c, book, benchVariant));
}

function readyForReuse(c: CharacterDef, key: string): void {
  keepGoing(
    (async () => {
      // (parts: made once, found at once if already made)
      await prepareParts(c).catch(() => null);
      // (poses: only for a newcomer that comes back)
      const seen = await timesSeen(key);
      if (seen >= 2) await Promise.allSettled(NEWCOMER_POSES.map((p) => prepareSprite(c, p)));
    })(),
  );
}

/** How many pages a newcomer has been on (counted, kept 180 days). */
async function timesSeen(key: string): Promise<number> {
  if (!metricsEnabled()) return 1;
  const [n] = await pipeline([
    ["INCR", `${key}:seen`],
    ["EXPIRE", `${key}:seen`, 180 * 86_400],
  ]).catch(() => [1]);
  return Number(n) || 1;
}
