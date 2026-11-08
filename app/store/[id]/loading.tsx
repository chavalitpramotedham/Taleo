import { LeafLoader } from "@/components/Icons";

/** While a library story is on its way: the closed book it opens on (its
 *  cover is the first page), with the falling leaves where the picture
 *  will be - right where the reader's eyes are going. */
export default function Loading() {
  return (
    <div className="reader reader-loading" role="status" aria-label="Opening the story">
      <div className="book-cover">
        <div className="book-cover-board">
          <div className="book-cover-frame">
            <p className="book-cover-kicker">A Taleo picture book</p>
            <span className="book-cover-title shown skeleton-cover-title" />
            <div className="book-cover-oval skeleton-cover-oval">
              <LeafLoader size={44} />
            </div>
            <p className="book-cover-starring">Opening the story…</p>
          </div>
        </div>
      </div>
    </div>
  );
}
