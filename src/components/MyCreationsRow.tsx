"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { GalleryEntry } from "@/lib/types";
import { STORY_DELETED_EVENT } from "@/lib/gallery-client";
import { SAVED_EVENT } from "@/lib/saved-client";
import { useRouter } from "next/navigation";
import { MapleMark } from "./Icons";
import { SideScroll } from "./SideScroll";
import { StoryCard } from "./StoryCard";
import { StoryPreview, stepper, summaryFromEntry } from "./StoryPreview";
import { LibraryActions } from "./GalleryShelf";
import { ShelfSkeleton } from "./ShelfSkeleton";

/** How many of your stories the row shows before handing over to your
 *  bookshelf. */
const SHOWN = 6;

/** Your bookshelf in one sideways row (originals, then saved). Past the
 *  first few it ends in an arrow card that opens your whole bookshelf. */
export function MyCreationsRow({ username }: { username: string | null }) {
  const [mine, setMine] = useState<GalleryEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // A story deleted from its preview leaves the row, and the page's
  // numbers (worked out on the server) are refreshed.
  const router = useRouter();
  useEffect(() => {
    const drop = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      setMine((list) => (list ? list.filter((s) => s.id !== id) : list));
      setOpenId(null);
      router.refresh();
    };
    window.addEventListener(STORY_DELETED_EVENT, drop);
    return () => window.removeEventListener(STORY_DELETED_EVENT, drop);
  }, [router]);

  // Your bookshelf in one row: your originals (newest first), then the
  // stories you've saved from the library (most recently saved first) -
  // straight from the two small bookshelf lists, not the whole library.
  useEffect(() => {
    if (!username) return setMine([]);
    let live = true;
    const get = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { stories: [] })).then((d: { stories?: GalleryEntry[] }) => d.stories ?? []);
    Promise.all([get("/api/gallery/mine"), get("/api/user/saved").catch(() => [])])
      .then(([originals, saved]) => {
        if (!live) return;
        const own = [...originals].sort((a, b) => b.createdAt - a.createdAt);
        const seen = new Set(own.map((e) => e.id));
        setMine([...own, ...saved.filter((e) => !seen.has(e.id))]);
      })
      .catch(() => live && setMine([]));
    return () => {
      live = false;
    };
  }, [username]);
  // Unsaving a story (from its preview) takes it off the row.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; saved: boolean }>).detail;
      if (d && !d.saved) setMine((list) => (list ? list.filter((s) => s.id !== d.id || s.authorUsername?.toLowerCase() === username?.toLowerCase()) : list));
    };
    window.addEventListener(SAVED_EVENT, on);
    return () => window.removeEventListener(SAVED_EVENT, on);
  }, [username]);

  if (mine === null) return <ShelfSkeleton count={3} row />;
  if (mine.length === 0)
    return (
      <div className="empty creations-empty">
        <p className="meta">Your finished stories will line up here.</p>
        <Link className="btn btn-primary" href="/create">
          <MapleMark />
          Begin your first story
        </Link>
      </div>
    );

  const open = openId ? mine.find((e) => e.id === openId) : null;
  const shelf = "/my-stories";
  return (
    <>
      <SideScroll className="creations-row" label="More of my stories">
        {mine.slice(0, SHOWN).map((s) => (
          <StoryCard key={s.id} entry={s} onOpen={() => setOpenId(s.id)} />
        ))}
        {/* the way to your whole bookshelf, at the end of the row */}
        <Link href={shelf} className="creations-more">
          <span className="creations-more-arrow" aria-hidden>
            →
          </span>
          <span>View all in bookshelf</span>
        </Link>
      </SideScroll>
      {open && (
        <StoryPreview story={summaryFromEntry(open)} onClose={() => setOpenId(null)} {...stepper(mine.slice(0, SHOWN), open.id, setOpenId)}>
          <LibraryActions
            entry={open}
            onCopied={() => {
              setToast("Link copied. Paste it anywhere to share.");
              window.setTimeout(() => setToast(null), 2400);
            }}
          />
        </StoryPreview>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
