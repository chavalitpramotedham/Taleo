import type { Metadata } from "next";
import { GalleryShelf } from "@/components/GalleryShelf";
import { StoryIndex, publicStories } from "@/components/StoryIndex";
import { OG_IMAGE, SITE_URL, breadcrumbs, jsonLd } from "@/lib/seo";

const TITLE = "The Public Library: free bedtime stories for kids";
const DESCRIPTION =
  "Read bedtime picture-book stories made and shared by parents: free to read, with a watercolour picture on every page. Sort by favourites or newest, or browse by kind of story.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/store" },
  openGraph: { type: "website", siteName: "Taleo", url: "/store", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const STRUCTURED = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/store`,
      url: `${SITE_URL}/store`,
      name: "The Taleo library",
      description: DESCRIPTION,
      inLanguage: "en",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: ["Bedtime stories", "Children's picture books"],
      audience: { "@type": "PeopleAudience", audienceType: "Parents of young children" },
    },
    breadcrumbs([
      { name: "Taleo", path: "/" },
      { name: "Public Library", path: "/store" },
    ]),
  ],
};

// Built once and served from Vercel's cache, rebuilt at most every 5
// minutes when visited: the list of stories at the foot of the page comes
// with the page itself (one free read of the library list per rebuild).
export const revalidate = 300;

export default async function StorePage() {
  const stories = await publicStories(revalidate);
  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(STRUCTURED)} />
      <GalleryShelf
        headClass="wizard-head"
        heading={
          <>
            <p className="eyebrow">Open to everyone</p>
            <h1>The Public Library</h1>
            <p className="sub">Every finished story, painted and shared by parents like you.</p>
          </>
        }
      />
      <StoryIndex stories={stories} heading="Every story in the library" />
    </div>
  );
}
