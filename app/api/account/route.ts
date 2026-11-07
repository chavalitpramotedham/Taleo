import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteMyStories } from "@/server/gallery";
import { deleteUser } from "@/server/users";

/** Deletes the signed-in user's account entirely: their profile and every
 *  story they published (ratings they left on other people's stories stay,
 *  since those stories' aggregates/comments shouldn't retroactively change). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.user.isAdmin) return NextResponse.json({ error: "The admin account can't be deleted here." }, { status: 400 });
  await deleteMyStories(session.user.id);
  await deleteUser(session.user.id);
  return NextResponse.json({ ok: true });
}
