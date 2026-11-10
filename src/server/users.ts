import type { ContentVisibility, UserProfile } from "@/lib/types";
import { AVATAR_KEYS } from "@/lib/presets";
import { readJson, writeJson } from "./store";

const INDEX_PATH = "users/index.json";

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

export async function listUsers(opts: { cacheSeconds?: number; fresh?: boolean } = {}): Promise<UserProfile[]> {
  return (await readJson<UserProfile[]>(INDEX_PATH, opts)) ?? [];
}

/** The index as it is right now, not the CDN's copy (which lags an overwrite
 *  by up to a minute). Every read-modify-write starts from this - otherwise
 *  a write made from a stale copy quietly drops whoever signed up in the
 *  last minute, and a brand-new account isn't in the list yet when they
 *  choose their username. */
const currentUsers = () => listUsers({ fresh: true });

async function writeUsers(users: UserProfile[]) {
  await writeJson(INDEX_PATH, users);
}

export async function getUser(id: string, opts: { fresh?: boolean } = {}): Promise<UserProfile | null> {
  if (id === ADMIN_USER_ID) return ADMIN_PROFILE;
  const users = await listUsers(opts);
  return users.find((u) => u.id === id) ?? null;
}

export async function getUserByUsername(username: string, opts: { cacheSeconds?: number } = {}): Promise<UserProfile | null> {
  const name = username.trim().toLowerCase();
  if (name === ADMIN_PROFILE.username) return ADMIN_PROFILE;
  const users = await listUsers(opts);
  return users.find((u) => u.username?.toLowerCase() === name) ?? null;
}

/** Called on every sign-in: creates the profile on first sign-in, refreshing
 *  the Google-provided name/picture each time. Username starts out null. */
export async function upsertFromGoogle(input: { id: string; email: string; name: string | null; image: string | null }): Promise<UserProfile> {
  const isAdmin = Boolean(ADMIN_EMAIL) && input.email.toLowerCase() === ADMIN_EMAIL;
  const users = await currentUsers();
  const i = users.findIndex((u) => u.id === input.id);
  if (i < 0) {
    const profile: UserProfile = {
      id: input.id,
      email: input.email,
      name: input.name,
      image: input.image,
      username: null,
      avatarKey: defaultAvatarFor(input.id),
      isAdmin,
      createdAt: Date.now(),
    };
    await writeUsers([...users, profile]);
    return profile;
  }
  const profile: UserProfile = {
    ...users[i],
    email: input.email,
    name: input.name,
    image: input.image,
    avatarKey: users[i].avatarKey ?? defaultAvatarFor(input.id),
    isAdmin: users[i].isAdmin || isAdmin,
  };
  const same = (Object.keys(profile) as (keyof UserProfile)[]).every((k) => profile[k] === users[i][k]);
  if (same) return profile; // nothing new - skip the write
  const next = [...users];
  next[i] = profile;
  await writeUsers(next);
  return profile;
}

export class UsernameTakenError extends Error {}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function setUsername(
  id: string,
  raw: string,
  /** who's asking (from their session): if their profile is missing from
   *  the index, it's re-created rather than leaving them stuck */
  who?: { email?: string | null; name?: string | null; image?: string | null },
): Promise<UserProfile> {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new Error("Usernames are 3-20 letters, numbers or underscores.");
  }
  if (username === ADMIN_PROFILE.username) throw new UsernameTakenError("That username is taken.");
  const users = await currentUsers();
  if (users.some((u) => u.id !== id && u.username?.toLowerCase() === username)) {
    throw new UsernameTakenError("That username is taken.");
  }
  const i = users.findIndex((u) => u.id === id);
  if (i < 0 && !who?.email) throw new Error("Sign in again and retry.");
  const base: UserProfile =
    i >= 0
      ? users[i]
      : {
          id,
          email: who!.email!,
          name: who?.name ?? null,
          image: who?.image ?? null,
          username: null,
          avatarKey: defaultAvatarFor(id),
          isAdmin: Boolean(ADMIN_EMAIL) && who!.email!.toLowerCase() === ADMIN_EMAIL,
          createdAt: Date.now(),
        };
  const profile: UserProfile = { ...base, username };
  if (i >= 0 && users[i].username === username) return profile; // already saved (a retry)
  const next = [...users];
  if (i >= 0) next[i] = profile;
  else next.push(profile);
  await writeUsers(next);
  return profile;
}

export async function setAvatar(id: string, key: string): Promise<UserProfile> {
  if (!AVATAR_KEYS.includes(key)) throw new Error("Not a valid avatar.");
  const users = await currentUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) throw new Error("Sign in again and retry.");
  const profile: UserProfile = { ...users[i], avatarKey: key };
  const next = [...users];
  next[i] = profile;
  await writeUsers(next);
  return profile;
}

export async function deleteUser(id: string) {
  const users = await currentUsers();
  await writeUsers(users.filter((u) => u.id !== id));
}

/** Private profiles are built but not offered yet (a likely paid feature):
 *  until TALEO_ALLOW_PRIVATE=1, everyone stays public. */
export const privateProfilesAvailable = () => process.env.TALEO_ALLOW_PRIVATE === "1";

export async function setVisibility(id: string, visibility: ContentVisibility): Promise<UserProfile> {
  if (visibility !== "public" && visibility !== "private") throw new Error("Not a valid setting.");
  if (visibility === "private" && !privateProfilesAvailable()) throw new Error("Private bookshelves aren't available yet.");
  const users = await currentUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) throw new Error("Sign in again and retry.");
  const profile: UserProfile = { ...users[i], visibility };
  const next = [...users];
  next[i] = profile;
  await writeUsers(next);
  return profile;
}

/** Ids of people whose stories are hidden from others (private profiles). */
export async function privateUserIds(opts: { cacheSeconds?: number } = {}): Promise<Set<string>> {
  const users = await listUsers(opts);
  return new Set(users.filter((u) => u.visibility === "private").map((u) => u.id));
}
