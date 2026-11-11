import { reportError } from "./alerts";
import { forgetBilling } from "./billing";
import { parkedPath } from "./character-jobs";
import { charactersPath } from "./characters";
import { CONTACT_INDEX, forgetContactMessages } from "./contact";
import { clearDraft, draftPath } from "./drafts";
import { forgetAccount } from "./entitlements";
import { deleteMyStories } from "./gallery";
import { forgetGens } from "./genlog";
import { forgetUsage, usagePath } from "./limits";
import { forgetMetricsUser } from "./metrics";
import { diaryPath } from "./reading";
import { savedPath } from "./saved";
import { canMovePlainFiles, deleteJson, deletePrivate, listPlain, movePlain, notePlainFilesMoved, readPrivate } from "./store";
import { ADMIN_USER_ID, deleteUser, listUsers } from "./users";

/**
 * Everything kept about one account, in one place - so deleting an account
 * really does remove all of it, and so there is one list to keep honest
 * when something new is stored (the privacy page says what's here).
 *
 * What stays, on purpose: ratings and comments left on other families'
 * stories (under the username they were written with), and the day's
 * totals in the usage figures, which name nobody.
 */
export async function deleteAccountData(userId: string): Promise<{ stories: number; problems: string[] }> {
  const problems: string[] = [];
  const step = async <T>(what: string, work: () => Promise<T>): Promise<T | null> => {
    try {
      return await work();
    } catch (e) {
      problems.push(what);
      console.error(`[account] couldn't remove ${what} for a deleted account`, e);
      return null;
    }
  };
  const [stories] = await Promise.all([
    step("published stories", () => deleteMyStories(userId)),
    step("characters", () => deletePrivate(charactersPath(userId))),
    step("the unfinished story", () => clearDraft(userId)),
    step("saved stories", () => deletePrivate(savedPath(userId))),
    step("the reading diary", () => deletePrivate(diaryPath(userId))),
    step("allowance counts", () => deletePrivate(usagePath(userId))),
    step("a waiting character", () => deletePrivate(parkedPath(userId))),
    step("credits", () => forgetBilling(userId)),
    step("the activity log", () => forgetGens(userId)),
    step("usage figures", () => forgetMetricsUser(userId)),
    step("messages sent to us", () => forgetContactMessages(userId)),
  ]);
  // (the profile last: until it's gone the person can simply try again)
  await deleteUser(userId);
  forgetAccount(userId);
  forgetUsage(userId);
  if (problems.length) await reportError("account", new Error(`An account was deleted, but some of its records could not be removed: ${problems.join(", ")}.`)).catch(() => {});
  return { stories: stories ?? 0, problems };
}

// ----------------------------------------------------------- the one-off move

/** Per-account files that used to sit under plain names: the folder, and
 *  how a file's name gives the account. */
const PLAIN_FOLDERS = ["users/saved/", "users/reading/", "characters/", "ratelimits/", "pending/character/"];
const DAY = 86_400_000;

let moving: Promise<unknown> | null = null;
/**
 * Moves every file written before private storage existed into it, and
 * removes what was left behind by accounts deleted before deletion was
 * thorough (their characters, diaries, saved lists, counts and unfinished
 * stories). Run once, by the real site only; safe to run again.
 */
export function sweepPlainFiles(): Promise<unknown> {
  return (moving ??= (async () => {
    if (!canMovePlainFiles) return;
    if (await readPrivate("migrations/plain-files-moved", { fresh: true }).catch(() => true)) return;
    const users = await listUsers({ fresh: true }); // (moves the account list itself)
    // (an empty list is far likelier a mistake than the truth: touch nothing)
    if (!users.length) return;
    const known = new Set([ADMIN_USER_ID, ...users.map((u) => u.id)]);
    const old = Date.now() - DAY;
    let moved = 0;
    let removed = 0;
    for (const folder of PLAIN_FOLDERS) {
      for (const f of await listPlain(folder)) {
        const id = f.pathname.slice(folder.length).replace(/\.json$/, "");
        if (known.has(id)) {
          await movePlain(f.pathname);
          moved++;
        } else if (f.at < old) {
          await deleteJson(f.pathname);
          removed++;
        }
      }
    }
    // Unfinished stories were always under names nobody can work out;
    // what's left of deleted accounts' is found by elimination.
    const drafts = new Set([...known].map(draftPath));
    for (const f of await listPlain("drafts/")) {
      if (drafts.has(f.pathname) || f.at >= old) continue;
      await deleteJson(f.pathname);
      removed++;
    }
    for (const f of await listPlain("contact/messages/")) {
      await movePlain(f.pathname);
      moved++;
    }
    await movePlain(CONTACT_INDEX);
    await movePlain("users/index.json");
    await notePlainFilesMoved({ at: Date.now(), moved, removed });
    console.info(`[store] plain files moved to private storage: ${moved} moved, ${removed} left by deleted accounts removed.`);
  })().catch(async (e) => {
    moving = null;
    console.error("[store] moving plain files failed", e);
    await reportError("storage", e).catch(() => {});
  }));
}
