import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { reassignLegacyStories } from "@/server/gallery";

/** Admin-only: moves every story still attributed to the legacy @taleo
 *  placeholder onto the caller's own account. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!session.user.username) return NextResponse.json({ error: "Pick a username first." }, { status: 400 });
  const claimed = await reassignLegacyStories(session.user.id, session.user.username);
  return NextResponse.json({ claimed });
}
