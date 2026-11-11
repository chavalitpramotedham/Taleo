"use client";
import { useEffect, useState } from "react";
import { discardCredits } from "@/lib/drafts-client";
import { CreditIcon } from "./Icons";

/**
 * Under a "delete this unfinished story?" question: what it means for
 * credits, where credits are involved at all.
 *  - not yet at its first choice, with credits set aside for it: they
 *    will be returned;
 *  - past its first choice, and paid for with credits: they stay spent.
 * Says nothing for a story made on the plan's own allowance.
 */
export function DiscardCreditsNote() {
  const [about, setAbout] = useState<{ held: number; spent: boolean } | null>(null);
  useEffect(() => {
    let here = true;
    void discardCredits().then((a) => here && setAbout(a));
    return () => {
      here = false;
    };
  }, []);
  if (!about) return null;
  return (
    <p className={`discard-credits ${about.held ? "back" : "kept"}`}>
      <CreditIcon size={18} />
      <span>
        {about.held
          ? `This story hasn't reached its first choice, so the ${about.held.toLocaleString("en-GB")} ${about.held === 1 ? "credit" : "credits"} set aside for it will be returned to you.`
          : "This story is past its first choice, so the credits used for it won't be refunded."}
      </span>
    </p>
  );
}
