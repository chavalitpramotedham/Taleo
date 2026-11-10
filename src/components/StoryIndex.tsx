import Link from "next/link";
import { ageById } from "@/lib/ages";
import { listGallery } from "@/server/gallery";
import { privateUserIds } from "@/server/users";
import type { GalleryEntry } from "@/lib/types";

const names = (n: string[]) => (n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0]);

/** The library's public stories, newest first, for a page that is itself
 *  cached (one free read of the library list per rebuild). Private
 *  bookshelves stay out. Empty if storage can't be reached. */
export async function publicStories(cacheSeconds: number, author?: string): Promise<GalleryEntry[]> {
  try {
    const [all, hidden] = await Promise.all([listGallery({ cacheSeconds }), privateUserIds({ cacheSeconds }).catch(() => new Set<string>())]);
    return all
      .filter((e) => !hidden.has(e.authorId) && (!author || e.authorUsername?.toLowerCase() === author.toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("[story-index] couldn't list stories", err);
    return [];
  }
}

/**
 * Every story on the shelf above, written out as a plain list of links -
 * like the index at the back of a book. The shelf itself is filled in by
 * the browser; this list arrives with the page, so search engines (and
 * anyone without scripts) can find each story from here.
 */
export function StoryIndex({ stories, heading, showAuthor = true }: { stories: GalleryEntry[]; heading: string; showAuthor?: boolean }) {
  if (stories.length === 0) return null;
  return (
    <nav className="story-index" aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        {stories.map((s) => {
          const cast = s.starring?.length ? s.starring : s.heroName ? [s.heroName] : [];
          const bits = [
            s.keyword?.trim(),
            cast.length ? `starring ${names(cast)}` : null,
            `ages ${ageById(s.age).label.replace(/\s*–\s*/g, "-")}`,
            showAuthor && s.authorUsername ? `by @${s.authorUsername}` : null,
          ].filter(Boolean);
          return (
            <li key={s.id}>
              <Link href={`/store/${s.id}`} prefetch={false}>
                {s.title || "An untitled story"}
              </Link>
              <span className="story-index-meta">{bits.join(" · ")}</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
