"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Rights } from "@/server/rights";
import { CreditIcon, ShelfIcon } from "./Icons";

/** Asked for when the account menu opens (and again each time it does:
 *  what's left changes as stories are made). */
const read = (): Promise<Rights | null> =>
  fetch("/api/account/entitlements", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Rights>) : null))
    .catch(() => null);

/** "1 story left", "No stories left today", "Stories: unlimited" */
export function storiesLeftText(r: Rights): string {
  if (r.creditsMode === "always") return "Stories use credits";
  const n = r.stories.left;
  if (n === null) return "Unlimited stories";
  if (n === 0) return r.stories.windowHours === 24 ? "No stories left today" : "No stories left for now";
  return `${n} ${n === 1 ? "story" : "stories"} left${r.stories.windowHours === 24 ? " today" : ""}`;
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
          <span className="allowance-item">
            <ShelfIcon />
            <span>{storiesLeftText(rights)}</span>
          </span>
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
