import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteMyStories } from "@/server/gallery";

/** Deletes every published story owned by the signed-in user (and their ratings). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const count = await deleteMyStories(session.user.id);
  return NextResponse.json({ deleted: count });
}
