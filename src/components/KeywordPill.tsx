import { keywordColour } from "@/lib/keywords";

/** A story's keyword ("Family", "Adventure") as a small pill in its own
 *  colour. Renders an empty, same-height placeholder when there's no
 *  keyword, so titles beneath still line up across a shelf. */
export function KeywordPill({ keyword }: { keyword?: string }) {
  if (!keyword) return <span className="keyword-pill keyword-pill-empty" aria-hidden />;
  return (
    <span className="keyword-pill" style={{ "--kw": keywordColour(keyword) } as React.CSSProperties}>
      {keyword}
    </span>
  );
}
