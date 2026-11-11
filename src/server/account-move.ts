import type { UserProfile } from "@/lib/types";
import { deletePrefix, readJson } from "./store";
import { ACCOUNT_DOCS, legacyRetired, markLegacyRetired, privateHas, privateStoreAvailable, readPrivate } from "./private-store";
import { ADMIN_USER_ID, LEGACY_INDEX_PATH, importLegacyUsers, listUsers } from "./users";
import { CONTACT_INDEX, contactMessagePath, type ContactIndex } from "./contact";

/**
 * Moving account records out of the public file store and into the
 * private one (server/private-store) - the admin's two steps:
 *
 *   copy    bring across everything that isn't here yet. Never overwrites
 *           what is already here, so it can be run any number of times.
 *   retire  check that every profile is here, remove the old public
 *           files, and stop looking for them. Not undoable: the admin is
 *           asked first.
 *
 * Neither is needed for the site to work: profiles are copied by
 * themselves the first time one is asked for, and every other record the
 * first time its owner needs it. The copy makes sure of the accounts that
 * haven't been back, so that the public files can go.
 *
 * What moves: profiles (users/index.json), and per account its usage
 * counts, saved characters, bookshelf, reading diary and any character
 * waiting to be collected; and the messages sent through Contact us.
 */

export interface MoveStatus {
  /** Whether there is a private store here at all. */
  available: boolean;
  /** The old public files are gone and no longer looked for. */
  retired: boolean;
  /** Profiles still in the public file (null: retired, or unreadable). */
  publicProfiles: number | null;
  /** Profiles in the private store. */
  privateProfiles: number;
  /** Profiles in the public file that aren't in the private store. */
  missing: number;
}

const legacyUsers = async () => ((await readJson<UserProfile[]>(LEGACY_INDEX_PATH, { fresh: true })) ?? []).filter((u) => u?.id && u.id !== ADMIN_USER_ID);

export async function moveStatus(): Promise<MoveStatus> {
  if (!privateStoreAvailable()) return { available: false, retired: false, publicProfiles: null, privateProfiles: 0, missing: 0 };
  const retired = await legacyRetired();
  const here = await listUsers({ fresh: true });
  if (retired) return { available: true, retired, publicProfiles: null, privateProfiles: here.length, missing: 0 };
  const old = await legacyUsers().catch(() => null);
  const ids = new Set(here.map((u) => u.id));
  return { available: true, retired, publicProfiles: old?.length ?? null, privateProfiles: here.length, missing: old?.filter((u) => !ids.has(u.id)).length ?? 0 };
}

/** A few at a time. */
async function each<T>(items: T[], work: (item: T) => Promise<void>, atOnce = 8) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

/** Every old address a record of these accounts could be at. */
const accountPaths = (ids: string[]) => ids.flatMap((id) => Object.values(ACCOUNT_DOCS).map((path) => path(id)));

/** Brings across each of these records that isn't here yet (reading one
 *  from the private store is what copies it). */
async function bring(paths: string[]): Promise<number> {
  const has = await privateHas(paths);
  let copied = 0;
  await each(paths.filter((_, i) => !has[i]), async (p) => {
    if ((await readPrivate<unknown>(p)) !== null) copied++;
  });
  return copied;
}

export interface CopyResult {
  profiles: { inPublicFile: number; copied: number };
  records: { copied: number };
}

export async function copyAccounts(): Promise<CopyResult> {
  if (await legacyRetired()) return { profiles: { inPublicFile: 0, copied: 0 }, records: { copied: 0 } };
  const profiles = await importLegacyUsers();
  const ids = [...new Set([...(await legacyUsers()).map((u) => u.id), ...(await listUsers({ fresh: true })).map((u) => u.id)])];
  let copied = await bring([...accountPaths(ids), CONTACT_INDEX]);
  const messages = (await readPrivate<ContactIndex>(CONTACT_INDEX)) ?? [];
  copied += await bring(messages.map((m) => contactMessagePath(m.id)));
  return { profiles: { inPublicFile: profiles.found, copied: profiles.copied }, records: { copied } };
}

/** Everywhere the old public files of account records were kept. Whole
 *  folders: files left by accounts deleted long ago are swept out too
 *  (nothing else has ever been kept under these names - a message's
 *  attachments are elsewhere under contact/, and stay). */
const PUBLIC_FOLDERS = [LEGACY_INDEX_PATH, "users/", "characters/", "ratelimits/", "pending/character/", CONTACT_INDEX, "contact/messages/"];

/** Removes the old public files, once everything in them is safely here. */
export async function retirePublicFiles(): Promise<{ removed: number }> {
  if (await legacyRetired()) return { removed: 0 };
  // (a record that can't be copied throws here, and nothing is removed)
  await copyAccounts();
  const old = await legacyUsers();
  const ids = new Set((await listUsers({ fresh: true })).map((u) => u.id));
  const missing = old.filter((u) => !ids.has(u.id));
  if (missing.length) throw new Error(`${missing.length} profile${missing.length === 1 ? " isn't" : "s aren't"} in the private store yet: nothing was removed. Copy again, then retry.`);
  // The profiles first: they are what matters most.
  let removed = 0;
  for (const folder of PUBLIC_FOLDERS) removed += await deletePrefix(folder);
  await markLegacyRetired();
  return { removed };
}
