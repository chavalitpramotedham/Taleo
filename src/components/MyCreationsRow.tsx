"use client";
import { QuotaNote } from "./QuotaNote";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "./Toast";
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
import { OngoingCard } from "./OngoingStory";
import { useOngoingStory } from "@/lib/ongoing";
import { IdeaCard, useSavedIdea } from "./NextAdventure";
import { forgetStory, recall, remember } from "@/lib/remember";

/** Originals (newest first), then the saved ones that aren't among them. */
function oneRow(originals: GalleryEntry[], saved: GalleryEntry[]) {
  const own = [...originals].sort((a, b) => b.createdAt - a.createdAt);
  const seen = new Set(own.map((e) => e.id));
  return [...own, ...saved.filter((e) => !seen.has(e.id))];
}

/** How many of your stories the row shows before handing over to your
 *  bookshelf. */
const SHOWN = 6;

/** Your bookshelf in one sideways row (originals, then saved). Past the
 *  first few it ends in an arrow card that opens your whole bookshelf. */
export function MyCreationsRow({ username }: { username: string | null }) {
  // (what was here last time shows at once; the server is still asked)
  const [mine, setMine] = useState<GalleryEntry[] | null>(() => {
    const originals = recall<GalleryEntry[]>("mine");
    const saved = recall<GalleryEntry[]>("saved");
    return username && originals && saved ? oneRow(originals, saved) : null;
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const toast = useToast();
  // The story under way (if any) leads the row.
  const ongoing = useOngoingStory();
  // ...followed by the story idea put away for later (if any).
  const idea = useSavedIdea();

  // A story deleted from its preview leaves the row, and the page's
  // numbers (worked out on the server) are refreshed.
  const router = useRouter();
  useEffect(() => {
    const drop = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) forgetStory(id);
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
        setMine(oneRow(remember("mine", originals), remember("saved", saved)));
      })
      .catch(() => live && setMine((cur) => cur ?? []));
    return () => {
      live = false;
    };
  }, [username]);
  // Unsaving a story (from its preview) takes it off the row.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; saved: boolean }>).detail;
      if (d && !d.saved) forgetStory(d.id, "saved");
      if (d && !d.saved) setMine((list) => (list ? list.filter((s) => s.id !== d.id || s.authorUsername?.toLowerCase() === username?.toLowerCase()) : list));
    };
    window.addEventListener(SAVED_EVENT, on);
    return () => window.removeEventListener(SAVED_EVENT, on);
  }, [username]);

  if (mine === null || ongoing.story === undefined || idea === undefined) return <ShelfSkeleton count={3} row />;
  const underWay = ongoing.story;
  if (mine.length === 0 && !underWay && !idea)
    return (
      <div className="empty creations-empty">
        <p className="meta">Every story you make together lands on this shelf, ready to read again tomorrow night.</p>
        <Link className="btn btn-primary" href="/create">
          <MapleMark />
          Begin your first story
        </Link>
        <QuotaNote />
      </div>
    );

  const open = openId ? mine.find((e) => e.id === openId) : null;
  const shelf = "/my-stories";
  return (
    <>
      <SideScroll className="creations-row" label="More of my stories">
        {underWay && <OngoingCard key={`ongoing-${underWay.id}`} story={underWay} onResume={ongoing.resume} onDiscard={() => ongoing.discard()} />}
        {idea && <IdeaCard key={`idea-${idea.key}`} idea={idea} />}
        {mine.slice(0, SHOWN).map((s) => (
          <StoryCard key={s.id} entry={s} onOpen={() => setOpenId(s.id)} />
        ))}
        {/* the way to your whole bookshelf, at the end of the row */}
        {mine.length > 0 && (
          <Link href={shelf} className="creations-more">
            <span className="creations-more-arrow" aria-hidden>
              →
            </span>
            <span>View all in bookshelf</span>
          </Link>
        )}
      </SideScroll>
      {open && (
        <StoryPreview story={summaryFromEntry(open)} onClose={() => setOpenId(null)} {...stepper(mine.slice(0, SHOWN), open.id, setOpenId)}>
          <LibraryActions
            entry={open}
            onCopied={() => toast("Link copied")}
          />
        </StoryPreview>
      )}
    </>
  );
}
