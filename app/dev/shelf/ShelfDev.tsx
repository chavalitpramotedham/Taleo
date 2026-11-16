"use client";
import type { GalleryEntry, Story } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { OngoingCard } from "@/components/OngoingStory";
import { StoryCard } from "@/components/StoryCard";

export function ShelfDev({ entries }: { entries: GalleryEntry[] }) {
  const cover = entries.find((e) => e.cover)?.cover ?? null;
  const story = { id: "wip", title: "Coliboo and the Moon Kite", hero: { name: "Coliboo" }, status: "writing", segments: [{ pages: [{ svg: cover }, { svg: null }, { svg: null }] }] } as unknown as Story;
  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">Just yours</p>
        <h1 className="author-title">
          <Avatar avatarKey="bear" className="author-avatar" />
          My bookshelf
        </h1>
      </header>
      <h2 className="shelf-section-title">My originals</h2>
      <div className="shelf">
        <OngoingCard story={story} onResume={() => {}} onDiscard={async () => {}} />
        {entries.map((s) => (
          <StoryCard key={s.id} entry={s} onOpen={() => {}} />
        ))}
      </div>
    </div>
  );
}
