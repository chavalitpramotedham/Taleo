import Link from "next/link";

/** The foot of every page: a few quiet links (not shown under a story
 *  being read, where the book fills the screen - see the styles). */
export function SiteFooter() {
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
