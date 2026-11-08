import { LeafLoader } from "./Icons";

/** Shown wherever a page (or part of one) is waiting on data, instead of
 *  a blank space: the brand's falling leaves with a short line of text.
 *  It fades in after a beat, so quick loads never flash it. */
export function PageLoading({ label = "Just a moment…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`page-loading ${compact ? "compact" : ""}`} role="status" aria-live="polite">
      <LeafLoader size={compact ? 40 : 56} />
      <p className="meta">{label}</p>
    </div>
  );
}
