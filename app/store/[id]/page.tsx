import type { Metadata } from "next";
import { getGalleryStory } from "@/server/gallery";
import { GalleryStoryClient } from "@/components/GalleryStoryClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = await getGalleryStory(id, { cacheSeconds: revalidate });
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

// Each shared story page is built once and then served from Vercel's cache,
// rebuilt at most every 5 minutes when visited (new ratings show within
// that), instead of running a server function on every single visit.
// Pages are built on first visit - none ahead of time.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

/** How many pages' paintings to send with the page itself - enough to show
 *  the opening straight away; the rest load in the background after. */
const EAGER_PICTURES = 2;

export default async function GalleryStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id, { cacheSeconds: revalidate });
  if (!story) return <GalleryStoryClient story={null} />;
  // Paintings are the heavy part of a story (often tens of KB each). Send
  // only the first few with the page so it appears fast, especially on a
  // phone; the reader fetches the full story right after.
  let n = 0;
  const light = {
    ...story,
    segments: story.segments.map((seg) => ({
      ...seg,
      pages: seg.pages.map((p) => (n++ < EAGER_PICTURES ? p : { ...p, svg: null })),
    })),
  };
  return <GalleryStoryClient story={light} partial={n > EAGER_PICTURES} />;
}
