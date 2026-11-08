import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { clearDraft, DRAFT_MAX_BYTES, getDraft, saveDraft } from "@/server/drafts";
import type { Story } from "@/lib/types";

/** The signed-in user's unfinished story: GET it, PUT to save, DELETE to
 *  discard (or, with ?id=, to clear it once that story is finished). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ draft: null });
  try {
    return NextResponse.json({ draft: await getDraft(session.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ draft: null }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const raw = await req.text();
  if (raw.length > DRAFT_MAX_BYTES) return NextResponse.json({ error: "Too large." }, { status: 413 });
  let story: Story;
  try {
    story = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!story?.id || typeof story.id !== "string" || !/^[a-z0-9]+$/i.test(story.id) || !Array.isArray(story.segments) || !story.hero) {
    return NextResponse.json({ error: "Not a story." }, { status: 400 });
  }
  if (story.status === "complete" && story.publishedPainted) {
    await clearDraft(session.user.id, story.id);
    return NextResponse.json({ ok: true, cleared: true });
  }
  await saveDraft(session.user.id, story);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || undefined;
  await clearDraft(session.user.id, id);
  return NextResponse.json({ ok: true });
}
