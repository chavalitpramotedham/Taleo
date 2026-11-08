import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { linkStory } from "@/server/characters";

/** Records that some of the caller's saved characters starred in a story
 *  (called when a story begins). Not surfaced in the UI yet - it's the
 *  memory future stories can draw on ("last week they went on an
 *  adventure together"). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { storyId?: unknown; characterIds?: unknown } | null;
  const storyId = typeof body?.storyId === "string" ? body.storyId.slice(0, 60) : "";
  const characterIds = Array.isArray(body?.characterIds)
    ? body.characterIds.filter((x): x is string => typeof x === "string").slice(0, 3)
    : [];
  if (!storyId || !characterIds.length) return NextResponse.json({ error: "Nothing to link." }, { status: 400 });
  await linkStory(session.user.id, characterIds, storyId);
  return NextResponse.json({ ok: true });
}
