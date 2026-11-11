import type { Metadata } from "next";
import { GalleryShelf } from "@/components/GalleryShelf";
import { Avatar } from "@/components/Avatar";
import { getUserByUsername } from "@/server/users";
import { StoryIndex, publicStories } from "@/components/StoryIndex";
import { OG_IMAGE, SITE_URL, breadcrumbs, jsonLd } from "@/lib/seo";

// Built on first visit and served from Vercel's cache, refreshed at most
// every 5 minutes (only the author's avatar comes from the server; their
// stories load from the edge-cached library list).
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const name = decodeURIComponent(username);
  const profile = await getUserByUsername(name, { cacheSeconds: revalidate }).catch(() => null);
  const shown = profile?.username || name;
  const count = profile && profile.visibility !== "private" ? (await publicStories(revalidate, shown)).length : 0;
  const title = `@${shown}'s bookshelf`;
  const description = `Bedtime picture-book stories by @${shown}, painted and shared on Taleo. Free to read, with a watercolour picture on every page.`;
  return {
    title,
    description,
    alternates: { canonical: `/author/${encodeURIComponent(shown)}` },
    openGraph: { type: "profile", siteName: "Taleo", url: `/author/${encodeURIComponent(shown)}`, title, description, username: shown, images: [OG_IMAGE] },
    // Unknown names, private bookshelves and shelves with nothing on them
    // yet stay out of search results.
    robots: count > 0 ? undefined : { index: false, follow: true },
  };
}

/** An author's bookshelf: every story they've shared to the library. */
export default async function AuthorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = decodeURIComponent(username);
  const profile = await getUserByUsername(name, { cacheSeconds: revalidate }).catch(() => null);
  const shown = profile?.username || name;
  if (profile?.visibility === "private") {
    return (
      <div className="container">
        <header className="wizard-head">
          <h1>Bookshelf</h1>
          <p className="sub">
            by <b className="author-handle">@{shown}</b>
          </p>
        </header>
        <div className="empty">
          <h2>This bookshelf is private</h2>
          <p className="meta">@{shown} keeps their stories to themselves.</p>
        </div>
      </div>
    );
  }
  const stories = await publicStories(revalidate, shown);
  const url = `${SITE_URL}/author/${encodeURIComponent(shown)}`;
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": url,
        url,
        name: `@${shown}'s bookshelf`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@type": "Person", name: `@${shown}`, alternateName: shown, url },
      },
      breadcrumbs([
        { name: "Taleo", path: "/" },
        { name: "Public Library", path: "/store" },
        { name: `@${shown}`, path: `/author/${encodeURIComponent(shown)}` },
      ]),
    ],
  };
  return (
    <div className="container">
      {profile && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />}
      <GalleryShelf
        author={shown}
        expect={stories.length}
        headClass="wizard-head"
        heading={
          <>
            <h1 className="author-title">
              {profile?.avatarKey && <Avatar avatarKey={profile.avatarKey} className="author-avatar" />}
              Bookshelf
            </h1>
            <p className="sub">
              by <b className="author-handle">@{shown}</b>
            </p>
          </>
        }
      />
      <StoryIndex stories={stories} heading={`Stories by @${shown}`} showAuthor={false} />
    </div>
  );
}
