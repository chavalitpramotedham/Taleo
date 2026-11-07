"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { StoryReader } from "./StoryReader";

export function GalleryStoryClient({ story }: { story: Story | null }) {
  const router = useRouter();

  if (!story)
    return (
      <div className="container empty">
        <h2>We couldn&apos;t find that story</h2>
        <p className="meta">It may have been removed from the store.</p>
        <Link className="btn btn-primary" href="/store">
          Back to the store
        </Link>
      </div>
    );

  const saveCopy = () => {
    const copy: Story = { ...story, id: newId(), createdAt: Date.now(), rating: 0, published: false };
    saveStory(copy);
    router.push(`/story/${copy.id}`);
  };

  return <StoryReader story={story} readOnly onSaveCopy={saveCopy} />;
}
