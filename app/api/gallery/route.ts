import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { listGallery, publishStory } from "@/server/gallery";
import type { Story } from "@/lib/types";

const avg = (e: { ratingSum: number; ratingCount: number }) => (e.ratingCount ? e.ratingSum / e.ratingCount : 0);

/** The public library. `?sort=rating|recent` and `?limit=N` let a page ask
 *  for just what it shows (the homepage needs 8 covers, not every story).
 *  Cached briefly at the edge - new stories and ratings show within a minute. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort");
  const limit = Math.min(200, Math.max(0, Number(url.searchParams.get("limit")) || 0));
  let stories = await listGallery();
  if (sort === "rating") stories = [...stories].sort((a, b) => avg(b) - avg(a) || b.createdAt - a.createdAt);
  else if (sort === "recent") stories = [...stories].sort((a, b) => b.createdAt - a.createdAt);
  if (limit) stories = stories.slice(0, limit);
  return NextResponse.json(
    { stories },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}

const MAX_BYTES = 4_000_000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.username) {
    return NextResponse.json({ error: "Sign in and choose a username first." }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "That story is too large to publish." }, { status: 413 });
  }
  let story: Story;
  try {
    story = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!story?.id || typeof story.id !== "string" || !/^[a-z0-9]+$/i.test(story.id) || !Array.isArray(story.segments) || story.segments.length === 0) {
    return NextResponse.json({ error: "Not a valid story." }, { status: 400 });
  }
  if (story.status !== "complete") {
    return NextResponse.json({ error: "Only finished stories can be published." }, { status: 400 });
  }
  try {
    const entry = await publishStory(story, { id: session.user.id, username: session.user.username });
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: "Couldn't publish that story." }, { status: 500 });
  }
}
