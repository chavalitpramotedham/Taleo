"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Rights } from "@/server/rights";
import { CreditIcon, OpenBookIcon } from "./Icons";

/** Asked for when the account menu opens (and again each time it does:
 *  what's left changes as stories are made). */
const read = (): Promise<Rights | null> =>
  fetch("/api/account/entitlements", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Rights>) : null))
    .catch(() => null);

const backIn = (sec: number) => {
  const m = Math.max(1, Math.ceil(sec / 60));
  return m >= 90 ? `${Math.round(m / 60)} hours` : `${m} minute${m === 1 ? "" : "s"}`;
};

/** The plan's free stories: "1 free story left", or once they're used,
 *  when the next one comes back - "Free story back in 5 hours". (Null: the
 *  plan has no free stories to count.) */
export function storiesLeftText(r: Rights): string | null {
  if (r.creditsMode === "always") return null;
  const n = r.stories.left;
  if (n === null) return null;
  if (n === 0) return r.stories.nextInSec > 0 ? `Free story back in ${backIn(r.stories.nextInSec)}` : "No free stories left";
  return `${n} free ${n === 1 ? "story" : "stories"} left`;
}

/**
 * At a glance, in the account menu: the stories left on the plan and the
 * credits held. A tap opens the details (Plans). The last answer is shown
 * at once while a fresh one is fetched, so the menu never opens empty
 * twice.
 */
let last: Rights | null = null;
export function AllowanceSummary({ onGo }: { onGo?: () => void }) {
  const [rights, setRights] = useState<Rights | null>(last);
  useEffect(() => {
    let here = true;
    read().then((r) => {
      if (r) last = r;
      if (here && r) setRights(r);
    });
    return () => {
      here = false;
    };
  }, []);
  return (
    <Link href="/account/plans" className="allowance-summary" role="menuitem" onClick={onGo} aria-label="What's left on your plan: see the details">
      {rights ? (
        <>
          {/* the plan's free stories first (how many are left, or when the
              next comes back), then the credits that pay for more */}
          {storiesLeftText(rights) && (
            <span className="allowance-item">
              <OpenBookIcon />
              <span>{storiesLeftText(rights)}</span>
            </span>
          )}
          {rights.credits !== null && (
            <span className="allowance-item">
              <CreditIcon />
              <span>
                <b>{rights.credits.toLocaleString("en-GB")}</b> {rights.credits === 1 ? "credit" : "credits"}
              </span>
            </span>
          )}
        </>
      ) : (
        <span className="allowance-item allowance-wait">Reading what&apos;s left…</span>
      )}
    </Link>
  );
}
