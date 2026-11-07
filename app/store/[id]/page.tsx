import type { Metadata } from "next";
import { getGalleryStory } from "@/server/gallery";
import { GalleryStoryClient } from "@/components/GalleryStoryClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = await getGalleryStory(id);
  if (!story) return { title: "Story not found · Taleo" };

  const title = story.title || "An untitled story";
  const rating = story.ratingCount ? ` · rated ${(story.ratingSum! / story.ratingCount).toFixed(1)}/5` : "";
  const description = `A Taleo picture-book story about ${story.hero.name}${rating}. Painted and shared for anyone to read.`;
  return {
    title: `${title} · Taleo`,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function GalleryStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id);
  return <GalleryStoryClient story={story} />;
}
