"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapleMark } from "./Icons";
import { StoryPreview, type StorySummary } from "./StoryPreview";

export type SharedStorySummary = StorySummary;

/** The welcome a visitor sees when they arrive from a shared story link:
 *  the homepage, with the story's preview on top and a button to start
 *  reading. Closing it (or starting to read) tidies the link out of the
 *  address bar so it doesn't reappear. */
export function SharedStoryWelcome({ story }: { story: SharedStorySummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const close = useCallback(() => {
    setOpen(false);
    router.replace("/", { scroll: false });
  }, [router]);

  if (!open) return null;

  return (
    <StoryPreview story={story} eyebrow="From one parent to another" onClose={close}>
      <div className="story-preview-actions">
        <Link className="btn btn-primary btn-block" href={`/store/${story.id}`} onClick={() => setOpen(false)}>
          <MapleMark />
          Start reading
        </Link>
        <button type="button" className="btn btn-ghost btn-block" onClick={close}>
          Look around first
        </button>
      </div>
    </StoryPreview>
  );
}
