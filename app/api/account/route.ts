import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteMyStories } from "@/server/gallery";
import { deleteUser } from "@/server/users";
import { ACCOUNT_DOCS, deletePrivate } from "@/server/private-store";
import { clearDraft } from "@/server/drafts";
import { forgetAccount } from "@/server/entitlements";

/** Deletes the signed-in user's account entirely: their profile, every
 *  story they published, and what was kept privately for them - saved
 *  characters, bookshelf, reading diary, an unfinished story. (Ratings
 *  they left on other people's stories stay, since those stories'
 *  aggregates/comments shouldn't retroactively change. So do their usage
 *  counts, for the few days they last - signing up again isn't a fresh
 *  allowance - and the ledger of anything they paid for.) */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.user.isAdmin) return NextResponse.json({ error: "The admin account can't be deleted here." }, { status: 400 });
  await deleteMyStories(session.user.id);
  const id = session.user.id;
  await deleteUser(id);
  forgetAccount(id);
  // (the account is gone whatever happens here; anything left behind is
  // unreachable, and logged so it can be cleared by hand)
  const { characters, saved, reading, parkedCharacter } = ACCOUNT_DOCS;
  const left = await Promise.allSettled([...[characters, saved, reading, parkedCharacter].map((path) => deletePrivate(path(id))), clearDraft(id)]);
  for (const r of left) if (r.status === "rejected") console.error("[account] couldn't remove a deleted account's record", r.reason);
  return NextResponse.json({ ok: true });
}
