"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOngoingStory } from "@/lib/ongoing";
import { MapleMark } from "./Icons";
import { OngoingSummary } from "./OngoingStory";

const ASKED = "taleo.draftAsked";

/**
 * On a visit after leaving a story unfinished (on any device): "Pick up
 * where you left off?" - Resume opens it again (finishing it publishes it
 * as usual). Asked once per visit; closing the popup just means "not now":
 * the story waits at the front of the bookshelf on the home page, to carry
 * on with or to delete from there.
 */
export function DraftPrompt() {
  const { status } = useSession();
  const path = usePathname();
  const [ask, setAsk] = useState(false);
  // Not while reading a story, and not on the way into a new one (that
  // path has its own word to say about the story under way).
  const quiet = path.startsWith("/story/") || path.startsWith("/create");

  useEffect(() => {
    if (status !== "authenticated" || quiet) return;
    try {
      if (sessionStorage.getItem(ASKED)) return;
    } catch {}
    setAsk(true);
  }, [status, quiet]);

  if (!ask || quiet) return null;
  return <Prompt onDone={() => setAsk(false)} />;
}

function Prompt({ onDone }: { onDone: () => void }) {
  const { story, resume } = useOngoingStory({ finishing: true });
  // Once it has been shown, that's this visit's asking done.
  useEffect(() => {
    if (!story) return;
    try {
      sessionStorage.setItem(ASKED, "1");
    } catch {}
  }, [story]);
  useEffect(() => {
    if (story === null) onDone();
  }, [story, onDone]);
  if (!story) return null;

  return (
    <div className="modal-backdrop" onClick={onDone}>
      <div className="modal-panel draft-prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Unfinished story">
        <div className="modal-head">
          <h3>Pick up where you left off?</h3>
          <button type="button" className="icon-btn" onClick={onDone} aria-label="Not now">
            ✕
          </button>
        </div>
        <OngoingSummary story={story} />
        <div className="story-preview-actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              onDone();
              resume();
            }}
          >
            <MapleMark />
            Resume the story
          </button>
          <button type="button" className="btn btn-soft btn-block" onClick={onDone}>
            Not now
          </button>
        </div>
        <p className="meta draft-later">It will wait for you at the front of your bookshelf.</p>
      </div>
    </div>
  );
}
