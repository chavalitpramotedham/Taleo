import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getDraft } from "@/server/drafts";
import { heldFor, pendingStoryHold, pendingStoryRef, wasPaid } from "@/server/billing";
import { storyTicket } from "@/server/tickets";

export const dynamic = "force-dynamic";

/**
 * What throwing the unfinished story away would mean for credits - asked
 * when the "delete this story?" question is put:
 *   held   credits set aside for it that would come back (it hasn't
 *          reached its first choice)
 *   spent  it was paid for with credits, which stay spent (it has)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ held: 0, spent: false }, { status: 401 });
  const userId = session.user.id;
  const draft = await getDraft(userId).catch(() => null);
  const pastFirstChoice = Boolean(draft && (draft.segments.length > 1 || draft.segments[0]?.chosen));
  let held = 0;
  let spent = false;
  // (what deleting it would return: exactly what was set aside for this
  // story - see voidStoryHold in ../route.ts)
  if (!pastFirstChoice) {
    const own = draft ? await heldFor(userId, pendingStoryRef(storyTicket(userId, { age: draft.age, minutes: draft.minutes, theme: draft.theme, segments: draft.segments.slice(0, 1) }))).catch(() => 0) : 0;
    held = own || ((await pendingStoryHold(userId).catch(() => null))?.amount ?? 0);
  }
  else if (draft) {
    // (the reference its first choice was paid under: the story as it
    // stood with only its opening written)
    const key = storyTicket(userId, { age: draft.age, minutes: draft.minutes, theme: draft.theme, segments: draft.segments.slice(0, 1) });
    spent = await wasPaid(userId, `story:${key}`.replace(/[^\w.:-]/g, "").slice(0, 110));
  }
  return NextResponse.json({ held, spent, pastFirstChoice }, { headers: { "cache-control": "private, no-store" } });
}
