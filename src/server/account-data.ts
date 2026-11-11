import { reportError } from "./alerts";
import { forgetBilling } from "./billing";
import { parkedPath } from "./character-jobs";
import { charactersPath } from "./characters";
import { CONTACT_INDEX, forgetContactMessages } from "./contact";
import { clearDraft, draftPath, moveDraft, oldDraftPath } from "./drafts";
import { forgetAccount } from "./entitlements";
import { deleteMyStories } from "./gallery";
import { forgetGens } from "./genlog";
import { forgetUsage, usagePath } from "./limits";
import { forgetMetricsUser } from "./metrics";
import { diaryPath } from "./reading";
import { savedPath } from "./saved";
import { canMovePlainFiles, deleteJson, deletePrivate, hasOwnDataSecret, listPlain, movePlain, notePlainFilesMoved, noteRekeyed, plainFilesMoved, readPrivate, rekeyed } from "./store";
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

const PLAIN_MOVED = "migrations/plain-files-moved";
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
    if (await readPrivate(PLAIN_MOVED, { fresh: true }).catch(() => true)) return;
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
    const drafts = new Set([...known].flatMap((id) => [draftPath(id), oldDraftPath(id) ?? ""]));
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

// ------------------------------------------------------- a new data secret

let rekeying: Promise<unknown> | null = null;
/**
 * Once TALEO_DATA_SECRET has a value of its own: reads every private file
 * (and unfinished story) still kept under the AUTH_SECRET key, which saves
 * each again under the new one, and leaves a note when none are left.
 * From then on AUTH_SECRET can be changed without losing anything. Run by
 * the real site only, after the plain files have been moved; safe to run
 * again.
 */
export function rekeyPrivateFiles(): Promise<unknown> {
  return (rekeying ??= (async () => {
    if (!hasOwnDataSecret || !canMovePlainFiles || (await rekeyed())) return;
    await sweepPlainFiles();
    await readPrivate(PLAIN_MOVED, { fresh: true }); // (the note itself moves first)
    if (!(await plainFilesMoved())) throw new Error("The plain files haven't all been moved yet.");
    const users = await listUsers({ fresh: true });
    if (!users.length) return;
    let accounts = 0;
    for (const id of [ADMIN_USER_ID, ...users.map((u) => u.id)]) {
      for (const path of [charactersPath, savedPath, diaryPath, usagePath, parkedPath]) await readPrivate(path(id), { fresh: true });
      await moveDraft(id);
      accounts++;
    }
    const messages = (await readPrivate<{ id: string }[]>(CONTACT_INDEX, { fresh: true })) ?? [];
    for (const m of messages) await readPrivate(`contact/messages/${m.id}.json`, { fresh: true });
    await noteRekeyed({ at: Date.now(), accounts, messages: messages.length });
    console.info(`[store] private files moved to the new data secret: ${accounts} accounts, ${messages.length} messages.`);
  })().catch(async (e) => {
    rekeying = null;
    console.error("[store] moving private files to the new data secret failed", e);
    await reportError("storage", e).catch(() => {});
  }));
}

/** Where the private files stand, for the admin's "what's live" dialog. */
export async function dataKeyStatus(): Promise<"shared" | "moving" | "own"> {
  if (!hasOwnDataSecret) return "shared";
  return (await rekeyed()) ? "own" : "moving";
}
