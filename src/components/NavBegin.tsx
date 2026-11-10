"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapleMark } from "./Icons";
import { quotaLine, useStoryAllowance } from "@/lib/allowance";
import { useMaking } from "@/lib/making";

/** "Begin a story" in the menu: always the maple leaf in its tinted pill.
 *  On wide screens, on pages without a Begin button of their own, the pill
 *  opens out to "Begin a story"; where the page already has one (the
 *  welcome page, Home) it stays just the leaf.
 *
 *  While a story is being made - in the wizard, or on a story whose words
 *  or pictures are still coming - it isn't a button at all: the leaf
 *  glows like the lantern and the pill says "Dreaming…", so a second
 *  story can't be begun on top of the first. Reading a finished story
 *  leaves it the ordinary button. */
export function NavBegin() {
  const path = usePathname();
  const making = useMaking() || path.startsWith("/create");
  const quiet = path === "/" || path === "/home";
  // (no room for a line under the pill: the limit goes in its tooltip)
  const limit = quotaLine(useStoryAllowance());
  if (making)
    return (
      <span className="nav-begin nav-begin-pill can-expand is-making" role="status" aria-label="A story is being made" title="A story is being made">
        <MapleMark />
        <span className="nav-begin-label" aria-hidden>
          Dreaming…
        </span>
      </span>
    );
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
