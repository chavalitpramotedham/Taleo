import type { ContentVisibility, UserProfile } from "@/lib/types";
import { AVATAR_KEYS } from "@/lib/presets";
import { deleteJson, readJson, writeJson } from "./store";
import { commit, commitAll, getRaw, legacyRetired, members, retryPause, type Tx } from "./private-store";

/**
 * Account profiles: who someone is (their Google account's email, name and
 * picture), the username and avatar they chose, and what the server has
 * decided about them (admin, plan, suspended).
 *
 * Kept in the private store (server/private-store), one record per
 * account:
 *
 *   user:<id>            the profile
 *   username:<username>  whose it is - a username is claimed in the same
 *                        step that saves it, so two people can't both
 *                        take one
 *   users:ids            every account (for the admin's list)
 *   users:private        accounts whose bookshelf is hidden
 *
 * Every change is made from the profile as it is now and refused if it
 * has changed in between (then read and tried again): signing in, picking
 * a username and an admin's change can all land together without one
 * undoing another, and nobody else's profile is touched at all.
 *
 * They used to be one publicly addressable file, users/index.json,
 * rewritten whole on every change. Whatever is in that file is copied
 * across once, the first time anything asks for a profile (see
 * `importLegacyUsers`), and the file is then removed by the admin (see
 * server/account-move).
 */

/** Where every profile used to be kept, in one public file. */
export const LEGACY_INDEX_PATH = "users/index.json";

const userKey = (id: string) => `user:${id}`;
const nameKey = (username: string) => `username:${username.toLowerCase()}`;
const IDS = "users:ids";
const PRIVATE = "users:private";
const MOVED = "users:moved";

/** Every story and rating made before accounts existed is attributed here. */
export const ADMIN_USER_ID = "admin";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

const ADMIN_PROFILE: UserProfile = {
  id: ADMIN_USER_ID,
  email: ADMIN_EMAIL || "admin@taleo.local",
  name: "Taleo",
  image: null,
  username: "taleo",
  avatarKey: "star",
  isAdmin: true,
  createdAt: 0,
};

/** A stable, deterministic pick so the same account always gets the same
 *  default avatar even if re-upserted, but different accounts spread out. */
function defaultAvatarFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_KEYS[hash % AVATAR_KEYS.length];
}

const parse = (raw: string | null): UserProfile | null => (raw ? (JSON.parse(raw) as UserProfile) : null);
const TRIES = 6;
const busy = () => new Error("Couldn't save that just now. Please try again.");

/**
 * Copies the profiles in the old public file into the private store -
 * only those not already here, so it can be run any number of times and
 * never undoes a change made since. Returns how many the file held and
 * how many were new here.
 */
export async function importLegacyUsers(): Promise<{ found: number; copied: number }> {
  const old = (await readJson<UserProfile[]>(LEGACY_INDEX_PATH, { fresh: true })) ?? [];
  const users = old.filter((u) => u && typeof u.id === "string" && u.id && u.id !== ADMIN_USER_ID);
  const done = await commitAll(
    users.map((u): Tx => ({
      check: [[userKey(u.id), null]],
      set: [[userKey(u.id), JSON.stringify(u)], ...(u.username ? [[nameKey(u.username), u.id] as [string, string]] : [])],
      sadd: [[IDS, u.id], ...(u.visibility === "private" ? [[PRIVATE, u.id] as [string, string]] : [])],
    })),
  );
  await commit({ set: [[MOVED, String(Date.now())]] });
  return { found: users.length, copied: done.filter(Boolean).length };
}

// The first time a profile is asked for on this server: make sure the old
// file's profiles have been brought across (one small read to find out;
// nothing at all once it's known).
let movedSeen = false;
let moving: Promise<unknown> | null = null;
async function ensureMoved(cacheSeconds?: number) {
  if (movedSeen) return;
  // (a cached page asks in a way that can be cached too - and only an
  // answer of "done" is believed from a copy)
  if (cacheSeconds && (await getRaw([MOVED], { cacheSeconds }))[0] !== null) return void (movedSeen = true);
  if ((await getRaw([MOVED]))[0] !== null) return void (movedSeen = true);
  moving ??= importLegacyUsers().finally(() => (moving = null));
  await moving;
  movedSeen = true;
}

export async function listUsers(opts: { cacheSeconds?: number; fresh?: boolean } = {}): Promise<UserProfile[]> {
  await ensureMoved(opts.cacheSeconds);
  const ids = await members(IDS, opts);
  const found = (await getRaw(ids.map(userKey), opts)).map(parse).filter((u): u is UserProfile => Boolean(u));
  // (oldest first, as the list always was)
  return found.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** (`fresh` is kept for callers that ask for it: every read is the
 *  profile as it is now.) */
export async function getUser(id: string, _opts: { fresh?: boolean } = {}): Promise<UserProfile | null> {
  if (id === ADMIN_USER_ID) return ADMIN_PROFILE;
  if (!id) return null;
  await ensureMoved();
  return parse((await getRaw([userKey(id)]))[0]);
}

export async function getUserByUsername(username: string, opts: { cacheSeconds?: number } = {}): Promise<UserProfile | null> {
  const name = username.trim().toLowerCase();
  if (name === ADMIN_PROFILE.username) return ADMIN_PROFILE;
  if (!USERNAME_RE.test(name)) return null;
  await ensureMoved(opts.cacheSeconds);
  const [id] = await getRaw([nameKey(name)], opts);
  if (!id) return null;
  const profile = parse((await getRaw([userKey(id)], opts))[0]);
  return profile?.username?.toLowerCase() === name ? profile : null;
}

const newProfile = (id: string, who: { email: string; name?: string | null; image?: string | null }): UserProfile => ({
  id,
  email: who.email,
  name: who.name ?? null,
  image: who.image ?? null,
  username: null,
  avatarKey: defaultAvatarFor(id),
  isAdmin: Boolean(ADMIN_EMAIL) && who.email.toLowerCase() === ADMIN_EMAIL,
  createdAt: Date.now(),
});

/** Called on every sign-in: creates the profile on first sign-in, refreshing
 *  the Google-provided name/picture each time. Username starts out null. */
export async function upsertFromGoogle(input: { id: string; email: string; name: string | null; image: string | null }): Promise<UserProfile> {
  const isAdmin = Boolean(ADMIN_EMAIL) && input.email.toLowerCase() === ADMIN_EMAIL;
  await ensureMoved();
  for (let attempt = 0; attempt < TRIES; attempt++) {
    await retryPause(attempt);
    const [raw] = await getRaw([userKey(input.id)]);
    const cur = parse(raw);
    if (!cur) {
      const profile = newProfile(input.id, input);
      // (only if they still aren't there: a second sign-in landing at the
      // same moment finds the first one's profile on its next try)
      if (await commit({ check: [[userKey(input.id), null]], set: [[userKey(input.id), JSON.stringify(profile)]], sadd: [[IDS, input.id]] })) return profile;
      continue;
    }
    const profile: UserProfile = {
      ...cur,
      email: input.email,
      name: input.name,
      image: input.image,
      avatarKey: cur.avatarKey ?? defaultAvatarFor(input.id),
      isAdmin: cur.isAdmin || isAdmin,
    };
    const same = (Object.keys(profile) as (keyof UserProfile)[]).every((k) => profile[k] === cur[k]);
    if (same) return profile; // nothing new - skip the write
    if (await commit({ check: [[userKey(input.id), raw]], set: [[userKey(input.id), JSON.stringify(profile)]], sadd: [[IDS, input.id]] })) return profile;
  }
  throw busy();
}

export class UsernameTakenError extends Error {}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function setUsername(
  id: string,
  raw: string,
  /** who's asking (from their session): if their profile is missing from
   *  the records, it's re-created rather than leaving them stuck */
  who?: { email?: string | null; name?: string | null; image?: string | null },
): Promise<UserProfile> {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new Error("Usernames are 3-20 letters, numbers or underscores.");
  }
  if (username === ADMIN_PROFILE.username) throw new UsernameTakenError("That username is taken.");
  await ensureMoved();
  for (let attempt = 0; attempt < TRIES; attempt++) {
    await retryPause(attempt);
    const [curRaw, holder] = await getRaw([userKey(id), nameKey(username)]);
    const check: NonNullable<Tx["check"]> = [[userKey(id), curRaw], [nameKey(username), holder]];
    if (holder !== null && holder !== id) {
      // Someone else's - unless they've since gone or moved on to another
      // name (then it's free, provided that's still so when it's saved).
      const [holderRaw] = await getRaw([userKey(holder)]);
      if (parse(holderRaw)?.username?.toLowerCase() === username) throw new UsernameTakenError("That username is taken.");
      check.push([userKey(holder), holderRaw]);
    }
    const cur = parse(curRaw);
    if (!cur && !who?.email) throw new Error("Sign in again and retry.");
    const base = cur ?? newProfile(id, { email: who!.email!, name: who?.name, image: who?.image });
    const profile: UserProfile = { ...base, username };
    if (cur?.username === username && holder === id) return profile; // already saved (a retry)
    const old = cur?.username?.toLowerCase();
    const saved = await commit({
      check,
      // (the name is claimed in the same step the profile is saved)
      set: [[userKey(id), JSON.stringify(profile)], [nameKey(username), id]],
      del: old && old !== username ? [nameKey(old)] : [],
      sadd: [[IDS, id]],
    });
    if (saved) return profile;
  }
  throw busy();
}

/** Changes one profile from what it is now (`to` returns what it should
 *  become, and anything to change alongside it in the same step). */
async function change(id: string, missing: string, to: (cur: UserProfile) => { profile: UserProfile; also?: Pick<Tx, "sadd" | "srem"> }): Promise<UserProfile> {
  await ensureMoved();
  for (let attempt = 0; attempt < TRIES; attempt++) {
    await retryPause(attempt);
    const [raw] = await getRaw([userKey(id)]);
    const cur = parse(raw);
    if (!cur) throw new Error(missing);
    const { profile, also } = to(cur);
    if (await commit({ check: [[userKey(id), raw]], set: [[userKey(id), JSON.stringify(profile)]], ...also })) return profile;
  }
  throw busy();
}

export async function setAvatar(id: string, key: string): Promise<UserProfile> {
  if (!AVATAR_KEYS.includes(key)) throw new Error("Not a valid avatar.");
  return change(id, "Sign in again and retry.", (cur) => ({ profile: { ...cur, avatarKey: key } }));
}

/** Removes an account's profile, and frees its username. */
export async function deleteUser(id: string) {
  await ensureMoved();
  let gone = false;
  for (let attempt = 0; attempt < TRIES && !gone; attempt++) {
    await retryPause(attempt);
    const [raw] = await getRaw([userKey(id)]);
    const name = parse(raw)?.username?.toLowerCase();
    const mine = name ? (await getRaw([nameKey(name)]))[0] === id : false;
    gone = await commit({
      check: [[userKey(id), raw], ...(name && mine ? [[nameKey(name), id] as [string, string]] : [])],
      del: [userKey(id), ...(name && mine ? [nameKey(name)] : [])],
      srem: [[IDS, id], [PRIVATE, id]],
    });
  }
  if (!gone) throw busy();
  // Until the old public file is retired, they are taken out of it too:
  // a deleted account's email shouldn't wait there, and a later copy
  // mustn't bring the account back.
  if (!(await legacyRetired())) {
    const old = await readJson<UserProfile[]>(LEGACY_INDEX_PATH, { fresh: true });
    if (old?.some((u) => u.id === id)) await writeJson(LEGACY_INDEX_PATH, old.filter((u) => u.id !== id));
  }
}

/** Removes the old public file of profiles (the admin's last step of the
 *  move - see server/account-move). */
export const deleteLegacyUsers = () => deleteJson(LEGACY_INDEX_PATH);

/** Private profiles are built but not offered yet (a likely paid feature):
 *  until TALEO_ALLOW_PRIVATE=1, everyone stays public. */
export const privateProfilesAvailable = () => process.env.TALEO_ALLOW_PRIVATE === "1";

export async function setVisibility(id: string, visibility: ContentVisibility): Promise<UserProfile> {
  if (visibility !== "public" && visibility !== "private") throw new Error("Not a valid setting.");
  if (visibility === "private" && !privateProfilesAvailable()) throw new Error("Private bookshelves aren't available yet.");
  return change(id, "Sign in again and retry.", (cur) => ({
    profile: { ...cur, visibility },
    also: visibility === "private" ? { sadd: [[PRIVATE, id]] } : { srem: [[PRIVATE, id]] },
  }));
}

/** Bars an account from making anything new, or lifts that (admin only:
 *  see app/api/admin/credits). The admin account can't be barred. */
export async function setSuspended(id: string, suspended: boolean): Promise<UserProfile> {
  if (id === ADMIN_USER_ID) throw new Error("The admin account can't be suspended.");
  return change(id, "No such account.", (cur) => {
    if (cur.isAdmin) throw new Error("The admin account can't be suspended.");
    return { profile: { ...cur, suspended: suspended || undefined } };
  });
}

/** Ids of people whose stories are hidden from others (private profiles). */
export async function privateUserIds(opts: { cacheSeconds?: number } = {}): Promise<Set<string>> {
  await ensureMoved(opts.cacheSeconds);
  return new Set(await members(PRIVATE, opts));
}
