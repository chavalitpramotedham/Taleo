"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/types";
import { getStory, saveStory } from "@/lib/storage";
import { flushDraft, saveDraftSoon } from "@/lib/drafts-client";
import { useSession } from "next-auth/react";
import { StoryReader } from "@/components/StoryReader";
import { PageLoading } from "@/components/PageLoading";
import { MapleMark } from "@/components/Icons";

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [story, setStory] = useState<Story | null | undefined>(undefined);
  const { status } = useSession();
  const signedIn = status === "authenticated";

  useEffect(() => {
    setStory(getStory(id) ?? null);
  }, [id]);

  const update = useCallback(
    (fn: (s: Story) => Story) => {
      setStory((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        saveStory(next);
        // Unfinished stories are also kept on the account (batched), so
        // they can be resumed later or elsewhere; finishing clears it.
        if (signedIn) saveDraftSoon(next);
        return next;
      });
    },
    [signedIn],
  );

  // Opening an unfinished story makes sure the account has it too (e.g. one
  // started before drafts were saved, or on this device only).
  const savedOnOpen = useRef(false);
  useEffect(() => {
    if (!signedIn || !story || savedOnOpen.current) return;
    savedOnOpen.current = true;
    saveDraftSoon(story);
  }, [signedIn, story]);

  // Leaving the story: save anything still waiting right away.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushDraft();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flushDraft();
    };
  }, []);

  if (story === undefined) return <PageLoading label="Opening the story…" />;
  if (story === null)
    return (
      <div className="container empty">
        <h1 className="empty-title">We couldn&apos;t find that story</h1>
        <p className="meta">Stories are kept on this device. It may have been tidied away.</p>
        <Link className="btn btn-primary" href="/create">
          <MapleMark />
          Begin a new story
        </Link>
      </div>
    );
  return <StoryReader story={story} update={update} />;
}
