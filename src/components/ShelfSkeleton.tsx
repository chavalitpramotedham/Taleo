/** Placeholder cards while a shelf loads, in the real cards' exact shape -
 *  a 4:3 picture, a keyword pill and room for a three-line title - so the
 *  shelf never jumps or stretches when the stories arrive. A soft sheen
 *  passes over them (a moving layer, no repainting). */
export function ShelfSkeleton({
  count = 6,
  label = "Fetching stories…",
  row = false,
}: {
  count?: number;
  label?: string;
  /** shaped like a sideways row of cards (the homepage's My creations) */
  row?: boolean;
}) {
  const cards = (
    <div className={row ? "creations-row shelf-skeleton" : "shelf shelf-skeleton"} role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="book-card skeleton-card" aria-hidden>
          <span className="cover" />
          <span className="body">
            <span className="keyword-pill skeleton-pill">&nbsp;</span>
            <span className="skeleton-title">
              <span className="skeleton-line" />
              <span className="skeleton-line short" />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
  // (inside the same wrapper as the real row, so nothing shifts when it arrives)
  return row ? <div className="side-scroll">{cards}</div> : cards;
}
