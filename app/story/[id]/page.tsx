"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import type { Story } from "@/lib/types";
import { getStory, saveStory } from "@/lib/storage";
import { StoryReader } from "@/components/StoryReader";
import { PageLoading } from "@/components/PageLoading";

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => {
    setStory(getStory(id) ?? null);
  }, [id]);

  const update = useCallback((fn: (s: Story) => Story) => {
    setStory((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveStory(next);
      return next;
    });
  }, []);

  if (story === undefined) return <PageLoading label="Opening the story…" />;
  if (story === null)
    return (
      <div className="container empty">
        <h2>We couldn&apos;t find that story</h2>
        <p className="meta">Stories are kept on this device. It may have been tidied away.</p>
        <Link className="btn btn-primary" href="/create">
          Begin a new story
        </Link>
      </div>
    );
  return <StoryReader story={story} update={update} />;
}
