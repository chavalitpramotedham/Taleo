"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapleMark } from "./Icons";
import { quotaLine, useStoryAllowance } from "@/lib/allowance";

/** "Begin a story" in the menu: always the maple leaf in its tinted pill.
 *  On wide screens, on pages without a Begin button of their own, the pill
 *  opens out to "Begin a story"; where the page already has one (the
 *  welcome page, Home) or you're making a story, it stays just the leaf. */
export function NavBegin() {
  const path = usePathname();
  const quiet = path === "/" || path === "/home" || path.startsWith("/create");
  // (no room for a line under the pill: the limit goes in its tooltip)
  const limit = quotaLine(useStoryAllowance());
  const title = limit ? `Begin a story - ${limit}` : "Begin a story";
  return (
    <Link href="/create" className={`nav-begin nav-begin-pill ${quiet ? "" : "can-expand"}`} aria-label={title} title={title}>
      <MapleMark />
      <span className="nav-begin-label" aria-hidden>
        Begin a story
      </span>
    </Link>
  );
}
