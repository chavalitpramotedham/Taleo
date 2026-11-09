import type { Metadata } from "next";
import { getGalleryStory } from "@/server/gallery";
import { GalleryStoryClient } from "@/components/GalleryStoryClient";
import { ageById } from "@/lib/ages";
import { allPages } from "@/lib/story-utils";
import { storyKeyword } from "@/lib/keywords";
import { SITE_URL, absoluteUrl, breadcrumbs, jsonLd } from "@/lib/seo";
import type { Story } from "@/lib/types";

const cast = (story: Story) => [story.hero, ...(story.companions ?? [])].map((c) => c.name).filter(Boolean);
const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "a little hero");
/** "1½ – 2" -> "1½-2": the age label, written compactly for search text. */
const ages = (story: Story) => ageById(story.age).label.replace(/\s*–\s*/g, "-");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = await getGalleryStory(id, { cacheSeconds: revalidate });
  if (!story) return { title: "Story not found", robots: { index: false } };

  const title = story.title || "An untitled story";
  const kind = storyKeyword(story).toLowerCase();
  const subject = ["mission", "mystery", "celebration"].includes(kind) ? `a ${kind}` : kind;
  const rating = story.ratingCount ? ` Rated ${(story.ratingSum! / story.ratingCount).toFixed(1)}/5 by parents.` : "";
  const description = `A bedtime picture book about ${subject}, starring ${listNames(cast(story))}, for ages ${ages(story)}. Free to read on Taleo, with a watercolour picture on every page.${rating}`;
  return {
    title,
    description,
    keywords: [...cast(story), `${kind} story`, "bedtime story", "picture book", "children's story", "read aloud"],
    authors: story.authorUsername ? [{ name: `@${story.authorUsername}`, url: `/author/${encodeURIComponent(story.authorUsername)}` }] : undefined,
    alternates: { canonical: `/store/${story.id}` },
    openGraph: { title, description, type: "article", siteName: "Taleo", url: `/store/${story.id}`, publishedTime: new Date(story.createdAt).toISOString() },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** The story described for search engines: a children's picture book, its
 *  author, characters, reading age and parents' ratings. */
function structured(story: Story) {
  const url = `${SITE_URL}/store/${story.id}`;
  const title = story.title || "An untitled story";
  const [minAge] = story.age.split(/[-+]/);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        "@id": url,
        url,
        name: title,
        image: absoluteUrl(`/store/${story.id}/opengraph-image`),
        bookFormat: "https://schema.org/EBook",
        genre: ["Children's picture book", "Bedtime story", storyKeyword(story)],
        about: storyKeyword(story),
        inLanguage: "en",
        numberOfPages: allPages(story).length,
        timeRequired: `PT${story.minutes || ageById(story.age).recommendedMinutes}M`,
        datePublished: new Date(story.createdAt).toISOString().slice(0, 10),
        isAccessibleForFree: true,
        typicalAgeRange: story.age.endsWith("+") ? `${minAge}-` : story.age.replace(/^1\.5/, "1"),
        audience: { "@type": "PeopleAudience", suggestedMinAge: Number(minAge) || 1 },
        character: cast(story).map((name) => ({ "@type": "Person", name })),
        author: story.authorUsername
          ? { "@type": "Person", name: `@${story.authorUsername}`, url: absoluteUrl(`/author/${encodeURIComponent(story.authorUsername)}`) }
          : { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        ...(story.ratingCount
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: ((story.ratingSum ?? 0) / story.ratingCount).toFixed(1), ratingCount: story.ratingCount, bestRating: 5, worstRating: 1 } }
          : {}),
      },
      breadcrumbs([
        { name: "Taleo", path: "/" },
        { name: "Library", path: "/store" },
        { name: title, path: `/store/${story.id}` },
      ]),
    ],
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
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured(story))} />
      <GalleryStoryClient story={light} partial={n > EAGER_PICTURES} />
    </>
  );
}
