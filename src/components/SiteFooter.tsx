"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Where a story is being made or read: nothing sits under those pages. */
const QUIET = [/^\/create(\/|$)/, /^\/story\//, /^\/store\/[^/]+/, /^\/shared(\/|$)/];

/** The foot of every page: a few quiet links - except while a story is
 *  being made or read, where the page is the story and nothing else. */
export function SiteFooter() {
  const path = usePathname() || "/";
  if (QUIET.some((r) => r.test(path))) return null;
  return (
    <footer className="site-footer">
      <nav aria-label="Footer">
        <Link href="/store">Library</Link>
        <span aria-hidden>·</span>
        <Link href="/about">About</Link>
        <span aria-hidden>·</span>
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/about#contact">Contact us</Link>
      </nav>
    </footer>
  );
}
