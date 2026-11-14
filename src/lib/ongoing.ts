"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Story } from "./types";
import { deleteStory, getStory, listStories, saveStory, storiesReady } from "./storage";
import { discardDraft, fetchDraft } from "./drafts-client";

/**
 * The story this account has under way: begun, not yet finished. There's
 * one at a time - it sits at the front of the bookshelf to be picked up
 * again or thrown away, and beginning another replaces it.
 *
 * It's looked for in two places: this device's own stories, and the copy
 * saved to the account (which is how it follows the reader to another
 * device). Whichever is further along is the one shown.
 */

/** Fired when the story under way changes (discarded, replaced). */
export const ONGOING_EVENT = "taleo:ongoing";

const unfinished = (s: Story) => s.status !== "complete";

/** This device's stories left unfinished (newest first). */
function localUnfinished(userId: string): Story[] {
  return listStories().filter((s) => !s.demo && s.segments.length > 0 && unfinished(s) && (!s.authorId || s.authorId === userId));
}

/** `finishing: true` also counts a story whose words are finished but
 *  whose pictures aren't all painted (opening it finishes them). */
export function useOngoingStory({ finishing = false } = {}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userId = session?.user?.id;
  // (undefined: still looking)
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => {
    if (status === "loading") return;
    if (!userId) return setStory(null);
    let live = true;
    const look = async () => {
      // (only to show it's there: without its paintings)
      const [draft] = await Promise.all([fetchDraft({ light: true }), storiesReady()]);
      if (!live) return;
      const local = localUnfinished(userId);
      // (a finished story's draft only counts where asked for - and never
      // once this device has it finished and published)
      const fromAccount = draft && (unfinished(draft) || (finishing && !getStory(draft.id)?.publishedPainted)) ? [draft] : [];
      const newest = [...local, ...fromAccount].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
      setStory(newest ?? null);
    };
    void look();
    window.addEventListener(ONGOING_EVENT, look);
    return () => {
      live = false;
      window.removeEventListener(ONGOING_EVENT, look);
    };
  }, [status, userId, finishing]);

  /** Opens it again where it was left. */
  const resume = useCallback(async () => {
    if (!story) return;
    const local = getStory(story.id);
    // (the account's copy was fetched without its paintings: the whole of
    // it is fetched now, before it's kept and opened)
    const full = (story as Story & { light?: boolean }).light ? ((await fetchDraft()) ?? story) : story;
    const keep = full.id === story.id ? full : story;
    const { light: _light, ...clean } = keep as Story & { light?: boolean };
    saveStory(local && (local.updatedAt ?? 0) > (clean.updatedAt ?? 0) ? local : clean);
    router.push(`/story/${story.id}`);
  }, [story, router]);

  /** Deletes it for good - from this device and from the account. With
   *  `all`, nothing unfinished is left behind anywhere (beginning a new
   *  story replaces whatever was under way). */
  const discard = useCallback(
    async ({ all = false } = {}) => {
      const ids = new Set(story ? [story.id] : []);
      if (all && userId) {
        for (const s of listStories()) if (!s.demo && unfinished(s) && (!s.authorId || s.authorId === userId)) ids.add(s.id);
        const draft = await fetchDraft({ light: true });
        if (draft && unfinished(draft)) ids.add(draft.id);
      }
      // (the account keeps one draft; clearing by id leaves any other alone)
      await Promise.all([...ids].map((id) => discardDraft(id)));
      for (const id of ids) deleteStory(id);
      setStory(null);
      window.dispatchEvent(new Event(ONGOING_EVENT));
    },
    [story, userId],
  );

  return { story, resume, discard };
}
