"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Story } from "@/lib/types";
import { decodeShared } from "@/lib/share";
import { newId, saveStory } from "@/lib/storage";
import { StoryReader } from "@/components/StoryReader";

export default function SharedPage() {
  const router = useRouter();
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => setStory(decodeShared(window.location.hash)), []);

  if (story === undefined) return null;
  if (!story)
    return (
      <div className="container empty">
        <h2>This story link looks broken</h2>
        <p className="meta">Ask for the link again, or make a brand-new story.</p>
        <Link className="btn btn-primary" href="/create">
          Make a story
        </Link>
      </div>
    );

  const saveCopy = () => {
    const copy: Story = { ...story, id: newId(), createdAt: Date.now(), rating: 0 };
    saveStory(copy);
    router.push(`/story/${copy.id}`);
  };

  return <StoryReader story={story} readOnly onSaveCopy={saveCopy} />;
}
