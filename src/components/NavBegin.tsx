"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapleMark } from "./Icons";

/** "Begin a story" in the menu: always the maple leaf in its tinted pill.
 *  On wide screens, on pages without a Begin button of their own, the pill
 *  opens out to "Begin a story"; where the page already has one (the
 *  welcome page, Home) or you're making a story, it stays just the leaf. */
export function NavBegin() {
  const path = usePathname();
  const quiet = path === "/" || path === "/home" || path.startsWith("/create");
  return (
    <Link href="/create" className={`nav-begin nav-begin-pill ${quiet ? "" : "can-expand"}`} aria-label="Begin a story" title="Begin a story">
      <MapleMark />
      <span className="nav-begin-label" aria-hidden>
        Begin a story
      </span>
    </Link>
  );
}
