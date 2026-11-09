"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapleMark } from "./Icons";

/** "Begin a story" in the menu. Where the page already has its own Begin
 *  button (the homepage) or you're already making one (/create), it's just
 *  the maple leaf; everywhere else the leaf sits in a small "Begin" pill. */
export function NavBegin() {
  const path = usePathname();
  const quiet = path === "/" || path === "/home" || path.startsWith("/create");
  return (
    <Link
      href="/create"
      className={`nav-begin ${quiet ? "nav-begin-leaf" : "nav-begin-pill"}`}
      aria-label="Begin a story"
      title="Begin a story"
    >
      <MapleMark />
      {!quiet && <span>Begin<span className="nav-begin-more"> a story</span></span>}
    </Link>
  );
}
