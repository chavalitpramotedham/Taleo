"use client";
import { useCallback, useEffect, useState } from "react";
import type { Rights } from "@/server/rights";
import { CreditIcon } from "./Icons";

const read = (): Promise<Rights | null> =>
  fetch("/api/account/entitlements", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Rights>) : null))
    .catch(() => null);

/** What making the next one will take from this account. */
export interface MakingCost {
  /** Credits it will use (a character's price; for a story, a credit for
   *  each minute - see `perMinute`) - null when it won't use any. */
  credits: number | null;
  /** For a story paid with credits: how many for each minute of it. */
  perMinute: number | null;
  /** When it will be one of the plan's free ones: how many are left
   *  (counting this one), said in a few words - "1 free story left this
   *  week". Null when it isn't free, or the plan has no count of them. */
  free: string | null;
  /** The same count as a number (null when there's none to use). */
  freeLeft: number | null;
  /** Ask again (after making one: the free one may just have been used). */
  again: () => void;
}

const freeLine = (left: number, one: string, many: string, per: string | null) => `${left.toLocaleString("en-GB")} free ${left === 1 ? one : many} left${per ? ` this ${per}` : ""}`;

/**
 * What the next character, or the next story, will take: one of the
 * plan's free ones (and how many are left), or credits (and how many).
 * Asked afresh when the button appears, and again (`again`) after each.
 */
export function useMakingCost(what: "character" | "story"): MakingCost {
  const [rights, setRights] = useState<Rights | null>(null);
  const again = useCallback(() => void read().then((r) => r && setRights(r)), []);
  useEffect(() => again(), [again]);
  const none = { credits: null, perMinute: null, free: null, freeLeft: null, again };
  if (!rights) return none;
  const pays = rights.creditsMode !== "beyond" && rights.credits !== null;
  if (what === "character") {
    const left = rights.characters.designsLeft;
    if (left === null) return none; // (no count: nothing to say)
    if (left > 0) return { ...none, free: freeLine(left, "character", "characters", rights.characters.designsPer) };
    // (what can pay: this week's credits from the plan, then bought ones)
    return { ...none, credits: pays && rights.credits! + (rights.weekly?.left ?? 0) >= rights.prices.character ? rights.prices.character : null };
  }
  const left = rights.stories.left;
  if (left === null) return none;
  if (left > 0) return { ...none, freeLeft: left, free: freeLine(left, "story", "stories", rights.stories.weekly ? "week" : rights.stories.windowHours === 24 ? "day" : null).replace("this day", "today") };
  return { ...none, perMinute: pays ? 1 : null };
}

/** On a button that starts something paid for with credits, after its
 *  words: a middle dot, how many, and the credit coin. Nothing at all when
 *  it costs none. */
export function CreditCost({ credits }: { credits: number | null | undefined }) {
  if (!credits) return null;
  return (
    <span className="credit-cost">
      <span className="credit-cost-dot" aria-hidden>
        ·
      </span>
      {/* (the figure, then the coin: the same order wherever an amount of credits is shown) */}
      <span className="credit-cost-n">
        {credits.toLocaleString("en-GB")}
        <span className="sr-only"> {credits === 1 ? "credit" : "credits"}</span>
      </span>
      <CreditIcon size={20} />
    </span>
  );
}

/**
 * The words on a button that makes something. Laid out as one row,
 * centred in the button: the mark on the left, and on its right a small
 * stack - the words (with what it costs in credits after them, if it costs
 * any) and, when it will be one of the plan's free ones, a small line
 * beneath saying how many are left.
 */
export function MakeLabel({ icon, children, credits, free }: { icon?: React.ReactNode; children: React.ReactNode; credits?: number | null; free?: string | null }) {
  return (
    <span className={`make-label${free ? " has-sub" : ""}`}>
      {icon && <span className="make-label-icon">{icon}</span>}
      <span className="make-label-stack">
        <span className="make-label-main">
          {children}
          <CreditCost credits={credits} />
        </span>
        {free && <span className="make-label-sub">{free}</span>}
      </span>
    </span>
  );
}
