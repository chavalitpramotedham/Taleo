import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteMyStories } from "@/server/gallery";

/** Deletes every published story owned by the signed-in user (and their ratings). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  // The admin account owns every story published before accounts existed:
  // deleting "my stories" there would empty the whole library.
  if (session.user.isAdmin) return NextResponse.json({ error: "The admin account's stories can't be bulk-deleted." }, { status: 400 });
  const count = await deleteMyStories(session.user.id);
  return NextResponse.json({ deleted: count });
}
