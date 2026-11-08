"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { StoryReader } from "./StoryReader";
import { fetchGalleryStory } from "@/lib/gallery-client";

export function GalleryStoryClient({ story: initial, partial = false }: { story: Story | null; partial?: boolean }) {
  const router = useRouter();
  const { status } = useSession();
  const signedIn = status === "authenticated";
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
        <h2>We couldn&apos;t find that story</h2>
        <p className="meta">It may have been removed from the store.</p>
        <Link className="btn btn-primary" href="/store">
          Back to the store
        </Link>
      </div>
    );

  const saveCopy = async () => {
    // Keep a copy with every painting (never a half-pictured one that would
    // need repainting).
    const complete = (await loadFull()) ?? story;
    const copy: Story = { ...complete, id: newId(), createdAt: Date.now(), rating: 0, published: false };
    saveStory(copy);
    router.push(`/story/${copy.id}`);
  };

  return <StoryReader story={story} readOnly onSaveCopy={signedIn ? saveCopy : signInToKeep} saveCopyLabel={signedIn ? undefined : "Sign in to create your own"} picturesPending={partial && story === initial} />;
}
