/** Placeholder cards while a shelf loads, in the real cards' exact shape -
 *  a 4:3 picture, a keyword pill and room for a three-line title - so the
 *  shelf never jumps or stretches when the stories arrive. A soft sheen
 *  passes over them (a moving layer, no repainting). */
export function ShelfSkeleton({ count = 6, label = "Fetching stories…" }: { count?: number; label?: string }) {
  return (
    <div className="shelf shelf-skeleton" role="status" aria-label={label}>
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
}
