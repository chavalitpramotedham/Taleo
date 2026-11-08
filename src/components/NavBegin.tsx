"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapleMark } from "./Icons";

/** "Begin a story" in the menu. The homepage already has its own big
 *  Begin button, so here it's a plain link; on every other page it's the
 *  highlighted primary action. */
export function NavBegin() {
  const home = usePathname() === "/";
  return (
    <Link href="/create" className={`nav-link ${home ? "" : "nav-primary"}`}>
      {!home && <MapleMark />}
      Begin a story
    </Link>
  );
}
