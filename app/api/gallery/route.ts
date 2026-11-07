import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { listGallery, publishStory } from "@/server/gallery";
import type { Story } from "@/lib/types";

export async function GET() {
  const stories = await listGallery();
  return NextResponse.json({ stories });
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
