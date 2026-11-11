import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteAccountData } from "@/server/account-data";

/** Deletes the signed-in user's account entirely: their profile and
 *  everything kept for it - see deleteAccountData for the list (ratings
 *  they left on other people's stories stay, since those stories'
 *  aggregates/comments shouldn't retroactively change). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.user.isAdmin) return NextResponse.json({ error: "The admin account can't be deleted here." }, { status: 400 });
  await deleteAccountData(session.user.id);
  return NextResponse.json({ ok: true });
}
