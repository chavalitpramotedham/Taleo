import { createHmac, timingSafeEqual } from "crypto";
import type { Page } from "@/lib/types";

/**
 * Proof that something the browser sends back is the server's own work.
 *
 * The app keeps a story in the browser while it's being read, so the paid
 * endpoints are handed their input by the browser: "continue this story",
 * "paint this page", "publish this book". Without proof, anyone could
 * script those with input of their own - a "continuation" of a story that
 * was never begun (a new story without using the day's allowance), a
 * painting of anything at all, a library book the storyteller never wrote.
 *
 * So the server signs what it writes, for the account it wrote it for:
 *
 *   page signature  on every page the storyteller writes; asked for when a
 *                   page is painted or a book is published
 *   story ticket    with every part that leaves the story unfinished; asked
 *                   for when the next part is requested
 *
 * Both are keyed by the server's secret, so they can't be made or moved to
 * another account, and they need no storage at all (checking one is a
 * calculation, not a read).
 */

const secret = process.env.AUTH_SECRET || "taleo-dev";
const mac = (label: string, parts: unknown) =>
  createHmac("sha256", `${secret}:${label}`).update(JSON.stringify(parts)).digest("base64url").slice(0, 22);
const same = (a: string, b: unknown) => typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Until this date, pages and stories made before signing existed (drafts
 *  in progress, older clients still open in a tab) are let through, under
 *  the usual safety caps. After it, only signed work is accepted. */
export const LEGACY_GRACE_UNTIL = Date.parse(process.env.TALEO_LEGACY_GRACE_UNTIL || "2026-11-25T00:00:00Z");
export const inLegacyGrace = () => Date.now() < LEGACY_GRACE_UNTIL;

// ---- pages ----

// (what a page says and shows - the parts a painting is made from. Trimmed
// to the same lengths the request parser allows, so a page signs the same
// whether it's fresh from the storyteller or back from the browser.)
const pageParts = (p: Pick<Page, "text" | "picture">) => [(p.text ?? "").slice(0, 800), (p.picture ?? "").slice(0, 1200)];

export const signPage = (userId: string, page: Pick<Page, "text" | "picture">) => mac("page", [userId, ...pageParts(page)]);

export function pageIsSigned(userId: string, page: Pick<Page, "text" | "picture">, sig: unknown): boolean {
  if (same(signPage(userId, page), sig)) return true;
  // (a page with no picture brief is sent to the painter with its text as
  // the brief)
  return page.picture === page.text && same(signPage(userId, { text: page.text, picture: "" }), sig);
}

// ---- stories ----

interface StorySoFar {
  age: string;
  minutes: number;
  theme: string;
  segments: { pages: Pick<Page, "text">[] }[];
}

// (who it's for, what was asked for, and every word written so far)
const storyParts = (s: StorySoFar) => [
  s.age,
  s.minutes,
  s.theme.trim().slice(0, 200),
  s.segments.map((g) => g.pages.slice(0, 8).map((p) => (p.text ?? "").slice(0, 800))),
];

/** The ticket for asking for the part after these. */
export const storyTicket = (userId: string, story: StorySoFar) => mac("story", [userId, ...storyParts(story)]);
export const storyTicketIsValid = (userId: string, story: StorySoFar, ticket: unknown) => same(storyTicket(userId, story), ticket);
