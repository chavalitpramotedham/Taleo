// The book cover of a story being made, at each stage (development only):
// writing, painting, and ready to open. No story is made.
"use client";
import { BookCover } from "@/components/BookCover";
import { StoryProgressBar } from "@/components/StoryProgressBar";
import type { Story } from "@/lib/types";

const hero = { id: "hero", name: "Kai", look: "a small boy in a mustard bobble hat", preset: "bunny" as const };
const base = { id: "devcover", title: "", createdAt: 0, updatedAt: 0, age: "4-5", minutes: 6, theme: "", world: "", hero, companions: [], cast: [], segments: [], status: "in-progress", rating: 0 } as unknown as Story;
const withPage = { ...base, title: "Kai and the Lantern of the North", segments: [{ pages: [{ text: "Once…", aside: null, picture: "", characters: ["hero"] }], choice: null }] } as unknown as Story;

export default function DevCover() {
  if (process.env.NODE_ENV !== "development") return null;
  const stages: [string, Story, number | null, boolean, boolean][] = [
    ["Writing", base, null, false, false],
    ["Painting", withPage, 60, true, false],
    ["Ready", withPage, 120, true, true],
  ];
  return (
    <main style={{ display: "flex", gap: 24, padding: 24, flexWrap: "wrap" }}>
      {stages.map(([name, story, shapes, painting, open]) => (
        <div key={name} className="reader" style={{ width: 380 }}>
        <div className="book-stage closed" style={{ position: "relative", height: 560 }}>
          <BookCover story={story} opening={false} canOpen={open} ready={false} onOpen={() => {}} isHeading={false}
            progress={<StoryProgressBar started={Date.now() - 9000} painting={painting} shapes={shapes} target={115} writing={story.title ? "Writing the first page…" : "Writing your story…"} done="Ready - open the book!" hint="Mixing the paints…" />} />
        </div>
        </div>
      ))}
    </main>
  );
}
