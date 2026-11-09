import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { NotYourStoryError, deleteStory, getGalleryStory } from "@/server/gallery";
import { unlinkStory } from "@/server/characters";
import { clearDraft } from "@/server/drafts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id);
  if (!story) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ story }, { headers: { "Cache-Control": "public, max-age=0, must-revalidate", "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
}

/** Delete a story (its author only): gone from the library, every shelf
 *  and count, its page and its ratings. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  if (!/^[a-z0-9]+$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const gone = await deleteStory(id, session.user.id);
    if (!gone) return NextResponse.json({ error: "That story doesn't exist any more." }, { status: 404 });
    await Promise.all([unlinkStory(session.user.id, id).catch(() => {}), clearDraft(session.user.id, id).catch(() => {})]);
    // Cached pages built from it: its own page (and preview image), the
    // library, the author's bookshelf, and the sitemap.
    for (const p of [`/store/${id}`, "/store", "/sitemap.xml", "/home", `/author/${encodeURIComponent(gone.authorUsername)}`]) revalidatePath(p);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotYourStoryError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[gallery] delete failed", err);
    return NextResponse.json({ error: "Couldn't delete the story. Please try again." }, { status: 500 });
  }
}
