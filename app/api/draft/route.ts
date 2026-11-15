import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { clearDraft, DRAFT_MAX_BYTES, getDraft, markDiscarded, saveDraft, wasDiscarded } from "@/server/drafts";
import { unlinkStory } from "@/server/characters";
import type { Story } from "@/lib/types";
import { releasePendingStories } from "@/server/billing";
import { releaseStorySession } from "@/server/story-session";

/** The signed-in user's unfinished story: GET it, PUT to save, DELETE to
 *  discard (or, with ?id=, to clear it once that story is finished). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ draft: null });
  try {
    let draft = await getDraft(session.user.id);
    // (one thrown away and saved again since: it stays gone)
    if (draft && (await wasDiscarded(session.user.id, draft.id))) {
      await clearDraft(session.user.id, draft.id).catch(() => {});
      draft = null;
    }
    // `?light=1`: for showing that a story is under way (the "pick up where
    // you left off" card), not for reading it - its paintings left out but
    // the cover's, so every page load doesn't download the whole book.
    if (draft && new URL(req.url).searchParams.get("light") === "1") {
      const coverAt = draft.segments.flatMap((s) => s.pages).findIndex((p) => p.svg);
      let n = -1;
      const light = {
        ...draft,
        light: true,
        segments: draft.segments.map((s) => ({ ...s, pages: s.pages.map((p) => (++n === coverAt ? p : { ...p, svg: undefined })) })),
      };
      return NextResponse.json({ draft: light }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "no-store" } });
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
  // (thrown away: a save still on its way never brings it back)
  if (await wasDiscarded(session.user.id, story.id)) return NextResponse.json({ ok: true, discarded: true });
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
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || undefined;
  await clearDraft(session.user.id, id);
  // Thrown away (not finished): credits set aside for it when it was begun
  // come back - if it hadn't reached its first choice, when they'd have
  // been spent - and the account's story session is free again.
  let returned = 0;
  if (url.searchParams.get("discard") === "1") {
    // (gone for good: remembered, so a late save can't bring it back, and
    // off the characters' "stories they were in")
    if (id) await Promise.all([markDiscarded(session.user.id, id), unlinkStory(session.user.id, id).catch(() => {})]);
    returned = await releasePendingStories(session.user.id, "The story was discarded before its first choice: credits returned").catch(() => 0);
    await releaseStorySession(session.user.id, null, true);
  }
  return NextResponse.json({ ok: true, returned });
}
