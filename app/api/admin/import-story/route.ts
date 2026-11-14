import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/server/entitlements";
import { publishStory } from "@/server/gallery";
import type { Story } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4_000_000;
const none = () => new NextResponse(null, { status: 404 });

/**
 * Publishes a finished book made outside the reader's flow - the painter
 * bench's test books - to the library under the admin's own account
 * (admin only; anyone else gets a 404). The library's usual route takes
 * only pages the storyteller signed for that account; this one is the
 * admin's way round that, for books the admin vouches for. Everything
 * else is as a normal publish: a complete story, the card details, family
 * notes stripped.
 */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return none();
  if (!admin.username) return NextResponse.json({ error: "Choose a username first." }, { status: 400 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "That story is too large to publish." }, { status: 413 });
  let story: Story;
  try {
    story = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!story?.id || typeof story.id !== "string" || !/^[a-z0-9]+$/i.test(story.id) || !Array.isArray(story.segments) || story.segments.length === 0 || !story.hero?.name) {
    return NextResponse.json({ error: "Not a valid story." }, { status: 400 });
  }
  if (story.status !== "complete") return NextResponse.json({ error: "Only finished stories can be published." }, { status: 400 });
  // (the bench's books carry no signatures: none are kept on the copy)
  for (const seg of story.segments) for (const p of seg.pages ?? []) delete p.sig;
  try {
    const entry = await publishStory({ ...story, authorId: admin.id, authorUsername: admin.username }, { id: admin.id, username: admin.username, isAdmin: true });
    for (const p of ["/store", `/author/${encodeURIComponent(entry.authorUsername)}`]) revalidatePath(p);
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("[import-story] couldn't publish", err);
    return NextResponse.json({ error: "Couldn't publish that story." }, { status: 500 });
  }
}
