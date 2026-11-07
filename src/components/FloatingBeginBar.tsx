"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const SHOW_AFTER = 260;

/** A floating "Begin a story" bar for the homepage, so the call to action
 *  stays reachable once the hero's own button has scrolled out of view. */
export function FloatingBeginBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`floating-cta ${show ? "show" : ""}`} aria-hidden={!show}>
      <Link href="/create" className="btn btn-primary floating-cta-btn" tabIndex={show ? 0 : -1}>
        Begin a story
      </Link>
    </div>
  );
}
