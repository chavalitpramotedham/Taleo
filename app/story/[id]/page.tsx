"use client";
import { QuotaNote } from "@/components/QuotaNote";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/types";
import { flushStories, getStory, saveStory, saveStorySoon } from "@/lib/storage";
import { fetchDraft, flushDraft, saveDraftSoon } from "@/lib/drafts-client";
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
    const local = getStory(id) ?? null;
    // A story reopened with pages still unpainted: before any is painted
    // again (paid work), see whether the account's copy already has the
    // picture - this device's copy can fall behind (storage full, or the
    // story was carried on elsewhere).
    if (!local || !local.segments.some((sg) => sg.pages.some((p) => !p.svg))) return setStory(local);
    let live = true;
    void fetchDraft().then((draft) => {
      if (!live) return;
      if (draft?.id !== id) return setStory(local);
      let filled = 0;
      const merged: Story = {
        ...local,
        segments: local.segments.map((sg, si) => ({
          ...sg,
          pages: sg.pages.map((p, pi) => {
            const kept = draft.segments[si]?.pages[pi];
            if (p.svg || !kept?.svg || kept.text !== p.text) return p;
            filled++;
            return { ...p, svg: kept.svg };
          }),
        })),
      };
      if (filled) saveStory(merged);
      setStory(filled ? merged : local);
    });
    return () => {
      live = false;
    };
  }, [id]);

  const update = useCallback(
    (fn: (s: Story) => Story) => {
      setStory((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        saveStorySoon(next);
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
      flushStories();
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
        <QuotaNote />
      </div>
    );
  return <StoryReader story={story} update={update} />;
}
