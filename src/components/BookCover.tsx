"use client";
import type { Story } from "@/lib/types";
import { CharacterPortrait, Painting } from "./art/Painting";
import { LeafLoader, Ornament } from "./Icons";

/**
 * The closed storybook shown while a new story is being written and its
 * first page painted: a classic cloth-bound cover with gilt borders, the
 * title stamped on it as soon as the storyteller has chosen it, and an
 * oval picture - the hero's portrait at first, then the first page's
 * painting once it's ready, so the cover matches the opening scene.
 */
/** Book cloths in the house colours - each story is bound in one, picked
 *  from its id, so the same book always has the same cover. */
const CLOTHS = [
  ["#7d3530", "#5a2321"], // oxblood
  ["#4f6040", "#35422b"], // forest
  ["#35506a", "#243a4f"], // deep blue
  ["#7a5a2c", "#58401d"], // ochre leather
  ["#5d3a55", "#42283c"], // plum
];
export function coverStyle(id: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const [a, b] = CLOTHS[h % CLOTHS.length];
  return { "--cloth-a": a, "--cloth-b": b } as React.CSSProperties;
}

export function BookCover({
  story,
  opening,
  canOpen,
  ready,
  onOpen,
  isHeading = false,
}: {
  story: Story;
  /** Swinging open (CSS animation) - the book underneath shows through. */
  opening: boolean;
  /** The first page's words are ready (so it can be opened early). */
  canOpen: boolean;
  /** A story that's already there to read (not one being made right now):
   *  the cover simply waits to be opened. */
  ready: boolean;
  onOpen: () => void;
  /** The page's main heading while the book is closed (the reader's own
   *  title only shows once it's open) - for screen readers and search. */
  isHeading?: boolean;
}) {
  const Title = isHeading ? "h1" : "h2";
  const first = story.segments[0]?.pages[0];
  const heroes = [story.hero, ...(story.companions ?? [])];
  const names = heroes.map((h) => h.name);
  const starring = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0];
  const status = ready ? null : !story.title ? "Writing your story…" : !first ? "Writing the first page…" : !first.svg ? "Painting the first page…" : "Opening the book…";

  return (
    <div className={`book-cover ${opening ? "opening" : ""} ${ready ? "ready" : ""}`} style={coverStyle(story.id)} aria-live="polite">
      <div className="book-cover-board">
        <div className="book-cover-frame">
          <p className="book-cover-kicker">A Taleo picture book</p>
          <Ornament className="book-cover-orn" />
          <Title className={`book-cover-title ${story.title ? "shown" : ""}`}>{story.title || " "}</Title>
          <div className="book-cover-oval">
            {first?.svg ? (
              <Painting svg={first.svg} title={story.title} className="book-cover-art" />
            ) : (
              <CharacterPortrait character={story.hero} className="book-cover-portrait" />
            )}
          </div>
          <p className="book-cover-starring">Starring {starring}</p>
          {status && (
            <div className="book-cover-status">
              {!first?.svg && <LeafLoader size={22} />}
              <span>{status}</span>
            </div>
          )}
          {canOpen && (ready || !first?.svg) && !opening && (
            <button type="button" className="book-cover-open" onClick={onOpen}>
              Open the book
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
