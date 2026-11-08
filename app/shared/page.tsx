"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { Story } from "@/lib/types";
import { decodeShared } from "@/lib/share";
import { newId, saveStory } from "@/lib/storage";
import { StoryReader } from "@/components/StoryReader";
import { PageLoading } from "@/components/PageLoading";
import { MapleMark } from "@/components/Icons";

export default function SharedPage() {
  const router = useRouter();
  const { status } = useSession();
  const signedIn = status === "authenticated";
  // Reading is open to everyone; signed out, the end page invites you to
  // sign in and create your own story instead of keeping a copy.
  const signInToKeep = () => router.push(`/sign-in?next=${encodeURIComponent("/create")}`);
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => {
    setStory(decodeShared(window.location.hash));
  }, []);

  if (story === undefined) return <PageLoading label="Opening the story…" />;
  if (!story)
    return (
      <div className="container empty">
        <h2>This story link seems torn</h2>
        <p className="meta">Ask for the link again, or begin a brand-new story.</p>
        <Link className="btn btn-primary" href="/create">
          <MapleMark />
          Begin a story
        </Link>
      </div>
    );

  const saveCopy = () => {
    const copy: Story = { ...story, id: newId(), createdAt: Date.now(), rating: 0 };
    saveStory(copy);
    router.push(`/story/${copy.id}`);
  };

  return <StoryReader story={story} readOnly onSaveCopy={signedIn ? saveCopy : signInToKeep} saveCopyLabel={signedIn ? undefined : "Sign in to create your own"} />;
}
