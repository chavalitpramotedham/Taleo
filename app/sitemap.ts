import type { MetadataRoute } from "next";
import { listGallery } from "@/server/gallery";
import { privateUserIds } from "@/server/users";
import { absoluteUrl } from "@/lib/seo";

// Rebuilt at most once an hour (one read of the library index, from the
// storage CDN), however often search engines ask for it.
export const revalidate = 3600;

/** Every public page: the home page, the library, each shared story and
 *  each author's bookshelf - so search engines find stories that are only
 *  listed by the library once the page has loaded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/store"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
  ];
  try {
    const [entries, hidden] = await Promise.all([listGallery({ cacheSeconds: revalidate }), privateUserIds({ cacheSeconds: revalidate })]);
    const shown = entries.filter((e) => !hidden.has(e.authorId));
    const authors = new Map<string, number>();
    for (const e of shown) {
      pages.push({ url: absoluteUrl(`/store/${e.id}`), lastModified: new Date(e.createdAt), changeFrequency: "monthly", priority: 0.7 });
      if (e.authorUsername) authors.set(e.authorUsername, Math.max(authors.get(e.authorUsername) ?? 0, e.createdAt));
    }
    for (const [username, latest] of authors) {
      pages.push({ url: absoluteUrl(`/author/${encodeURIComponent(username)}`), lastModified: new Date(latest), changeFrequency: "weekly", priority: 0.4 });
    }
  } catch (err) {
    // Storage hiccup: still offer the main pages rather than failing.
    console.error("[sitemap] couldn't list stories", err);
  }
  return pages;
}
