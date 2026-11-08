import Link from "next/link";

/** A persistent floating "Begin a story" bar for the homepage. */
export function FloatingBeginBar() {
  return (
    <div className="floating-cta touch-only">
      <Link href="/create" className="btn btn-primary floating-cta-btn">
        Begin a story
      </Link>
    </div>
  );
}
