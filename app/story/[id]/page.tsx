"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import type { Story } from "@/lib/types";
import { getStory, saveStory } from "@/lib/storage";
import { StoryReader } from "@/components/StoryReader";

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => setStory(getStory(id) ?? null), [id]);

  const update = useCallback((s: Story) => {
    setStory(s);
    saveStory(s);
  }, []);

  if (story === undefined) return null;
  if (story === null)
    return (
      <div className="container empty">
        <h2>We couldn&apos;t find that story</h2>
        <p className="meta">Stories are saved on this device. It may have been deleted.</p>
        <Link className="btn btn-primary" href="/create">
          Make a new story
        </Link>
      </div>
    );
  return <StoryReader story={story} onChange={update} />;
}
