import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { claimStorySession, deviceOf, releaseStorySession } from "@/server/story-session";

export const dynamic = "force-dynamic";

/** "Still here": the device with a story open says so every little while
 *  (see StoryReader), which keeps the account's story session its own. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const mine = await claimStorySession(session.user.id, deviceOf(req));
  return NextResponse.json({ ok: mine }, { status: mine ? 200 : 409 });
}

/** "I've left the story": the session is free for another device at once
 *  (without this it frees itself a minute or two later). */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  // (sent as the page goes away, when a header can't always be set: the
  // device may be in the address instead)
  const device = deviceOf(req) ?? new URL(req.url).searchParams.get("d");
  await releaseStorySession(session.user.id, device && /^[\w-]{8,64}$/.test(device) ? device : null);
  return NextResponse.json({ ok: true });
}
