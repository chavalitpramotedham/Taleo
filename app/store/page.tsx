import type { Metadata } from "next";
import { GalleryShelf } from "@/components/GalleryShelf";
import { OG_IMAGE, SITE_URL, breadcrumbs, jsonLd } from "@/lib/seo";

const TITLE = "The library: free bedtime stories for kids";
const DESCRIPTION =
  "Read bedtime picture-book stories made and shared by parents: free to read, with a watercolour picture on every page. Sort by favourites or newest, or browse by kind of story.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/store" },
  openGraph: { type: "website", siteName: "Noomi", url: "/store", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const STRUCTURED = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/store`,
      url: `${SITE_URL}/store`,
      name: "The Noomi library",
      description: DESCRIPTION,
      inLanguage: "en",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: ["Bedtime stories", "Children's picture books"],
      audience: { "@type": "PeopleAudience", audienceType: "Parents of young children" },
    },
    breadcrumbs([
      { name: "Noomi", path: "/" },
      { name: "Library", path: "/store" },
    ]),
  ],
};

export default function StorePage() {
  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(STRUCTURED)} />
      <GalleryShelf
        headClass="wizard-head"
        heading={
          <>
            <p className="eyebrow">Open to everyone</p>
            <h1>The library</h1>
            <p className="sub">Every finished story, painted and shared by parents like you.</p>
          </>
        }
      />
    </div>
  );
}
