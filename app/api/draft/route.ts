import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { clearDraft, DRAFT_MAX_BYTES, getDraft, markDiscarded, saveDraft, wasDiscarded } from "@/server/drafts";
import { unlinkStory } from "@/server/characters";
import type { Story } from "@/lib/types";
import { pendingStoryRef, releaseHold, releasePendingStories } from "@/server/billing";
import { storyTicket } from "@/server/tickets";
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
  const userId = session.user.id;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || undefined;
  const discarding = url.searchParams.get("discard") === "1";
  // (read before it's cleared: which story this is, and how far it got)
  const draft = discarding ? await getDraft(userId).catch(() => null) : null;
  await clearDraft(userId, id);
  let returned = 0;
  if (discarding) {
    // (gone for good: remembered, so a late save can't bring it back, and
    // off the characters' "stories they were in")
    if (id) await Promise.all([markDiscarded(userId, id), unlinkStory(userId, id).catch(() => {})]);
    returned = await voidStoryHold(userId, id, draft);
    await releaseStorySession(userId, null, true);
  }
  return NextResponse.json({ ok: true, returned });
}

/**
 * Throwing a story away voids what was authorised for it, like a card
 * authorisation that was never captured - and only that:
 *   - before its first choice, the credits set aside for THIS story when
 *     it was begun (held under its own opening's name) come back, exactly
 *     what was held, once (a second ask finds nothing to release);
 *   - past its first choice, nothing: that hold was captured as the spend,
 *     and the story's pages were made;
 *   - not saved to the account yet (thrown away within seconds of being
 *     begun), the one hold still waiting for a first choice is this
 *     story's - unless the account's copy is another story, whose hold it
 *     would be: then nothing.
 * Never more than was taken: every release ends one hold, in one step,
 * and gives back what that hold took from the balance.
 */
async function voidStoryHold(userId: string, id: string | undefined, draft: Story | null): Promise<number> {
  const note = "The story was thrown away before its first choice: the credits set aside for it are returned";
  if (draft && id && draft.id !== id) return 0;
  if (!draft) return releasePendingStories(userId, note).catch(() => 0);
  const pastFirstChoice = draft.segments.length > 1 || Boolean(draft.segments[0]?.chosen);
  if (pastFirstChoice) return 0;
  const key = storyTicket(userId, { age: draft.age, minutes: draft.minutes, theme: draft.theme, segments: draft.segments.slice(0, 1) });
  const own = await releaseHold(userId, pendingStoryRef(key), note).catch(() => ({ done: false, amount: 0 }));
  if (own.done) return own.amount;
  // (its opening not yet named for the hold - thrown away while it was
  // still being written: the one waiting hold is this story's, the
  // account's only story under way)
  return releasePendingStories(userId, note).catch(() => 0);
}
