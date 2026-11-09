"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Story } from "@/lib/types";
import { useSaved, setStorySaved } from "@/lib/saved-client";
import { useToast } from "./Toast";
import { StoryReader } from "./StoryReader";
import { fetchGalleryStory } from "@/lib/gallery-client";

export function GalleryStoryClient({ story: initial, partial = false }: { story: Story | null; partial?: boolean }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";
  const me = session?.user?.username?.toLowerCase();
  const mine = Boolean(me && initial?.authorUsername?.toLowerCase() === me);
  const saved = useSaved(initial?.id ?? "", signedIn && !mine && initial ? session?.user?.id : null);
  const toast = useToast();
  // Reading is open to everyone; signed out, the end page invites you to
  // sign in and create your own story instead of keeping a copy.
  const signInToKeep = () => router.push(`/sign-in?next=${encodeURIComponent("/create")}`);
  // The page arrives with only the opening paintings; fetch the full story
  // (every painting) in the background and swap it in once it lands.
  const [story, setStory] = useState(initial);
  const full = useRef<Promise<Story | null> | null>(null);
  const loadFull = () => (full.current ??= initial && partial ? fetchGalleryStory(initial.id).catch(() => null) : Promise.resolve(initial));
  useEffect(() => {
    if (!initial || !partial) return;
    let live = true;
    void loadFull().then((s) => {
      if (live && s) setStory(s);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, partial]);

  if (!story)
    return (
      <div className="container empty">
        <h1 className="empty-title">We couldn&apos;t find that story</h1>
        <p className="meta">It may have been removed from the library.</p>
        <Link className="btn btn-primary" href="/store">
          Back to the Public Library
        </Link>
      </div>
    );

  // Someone else's story can be saved to your bookshelf (a bookmark to the
  // library's copy - it stays theirs); your own is on your shelf already.
  const toggleSaved = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const next = !saved;
    const ok = await setStorySaved(userId, story.id, next);
    toast(ok ? (next ? "Added to your bookshelf" : "Removed from your bookshelf") : "Couldn't save that just now. Please try again.");
  };
  const label = !signedIn ? "Sign in to create your own" : saved ? "Saved to your bookshelf ✓" : "Save to my bookshelf";
  const action = !signedIn ? signInToKeep : mine || saved === null ? undefined : toggleSaved;

  return <StoryReader story={story} readOnly onSaveCopy={action} saveCopyLabel={label} picturesPending={partial && story === initial} />;
}
