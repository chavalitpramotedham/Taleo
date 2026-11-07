"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import type { Story } from "@/lib/types";
import { fetchGalleryStory } from "@/lib/gallery-client";
import { newId, saveStory } from "@/lib/storage";
import { StoryReader } from "@/components/StoryReader";

export default function GalleryStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetchGalleryStory(id).then((s) => live && setStory(s));
    return () => {
      live = false;
    };
  }, [id]);

  if (story === undefined) return null;
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
