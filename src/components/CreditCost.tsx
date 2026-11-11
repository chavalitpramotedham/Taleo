"use client";
import { useCallback, useEffect, useState } from "react";
import type { Rights } from "@/server/rights";
import { CreditIcon } from "./Icons";

const read = (): Promise<Rights | null> =>
  fetch("/api/account/entitlements", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Rights>) : null))
    .catch(() => null);

/**
 * What the next character will cost this account in credits - or null
 * when it won't cost any: the plan's free one is still there, or this
 * plan never pays with credits without being asked. Asked afresh when the
 * button appears, and again (`again`) after each painting, since the free
 * one may just have been used.
 */
export function useCharacterCredits(): { credits: number | null; again: () => void } {
  const [credits, setCredits] = useState<number | null>(null);
  const again = useCallback(() => {
    void read().then((r) => setCredits(r && r.creditsMode !== "beyond" && r.credits !== null && r.characters.designsLeft === 0 ? r.prices.character : null));
  }, []);
  useEffect(() => again(), [again]);
  return { credits, again };
}

/** On a button that starts something paid for with credits, after its
 *  words: a middle dot, the credit coin, and how many. Nothing at all when
 *  it costs none. */
export function CreditCost({ credits }: { credits: number | null | undefined }) {
  if (!credits) return null;
  return (
    <span className="credit-cost">
      <span className="credit-cost-dot" aria-hidden>
        ·
      </span>
      <CreditIcon size={20} />
      <span className="credit-cost-n">
        {credits.toLocaleString("en-GB")}
        <span className="sr-only"> {credits === 1 ? "credit" : "credits"}</span>
      </span>
    </span>
  );
}
