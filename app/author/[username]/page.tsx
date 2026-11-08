import type { Metadata } from "next";
import { GalleryShelf } from "@/components/GalleryShelf";
import { Avatar } from "@/components/Avatar";
import { getUserByUsername } from "@/server/users";

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
  return { title: `@${name}'s bookshelf · Taleo`, description: `Picture-book stories by @${name}, painted and shared on Taleo.` };
}

/** An author's bookshelf: every story they've shared to the library. */
export default async function AuthorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = decodeURIComponent(username);
  const profile = await getUserByUsername(name, { cacheSeconds: revalidate }).catch(() => null);
  const shown = profile?.username || name;
  return (
    <div className="container">
      <GalleryShelf
        author={shown}
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
    </div>
  );
}
