import type { UserProfile } from "@/lib/types";
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
  isAdmin: true,
  createdAt: 0,
};

async function listUsers(): Promise<UserProfile[]> {
  return (await readJson<UserProfile[]>(INDEX_PATH)) ?? [];
}

async function writeUsers(users: UserProfile[]) {
  await writeJson(INDEX_PATH, users);
}

export async function getUser(id: string): Promise<UserProfile | null> {
  if (id === ADMIN_USER_ID) return ADMIN_PROFILE;
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const name = username.trim().toLowerCase();
  if (name === ADMIN_PROFILE.username) return ADMIN_PROFILE;
  const users = await listUsers();
  return users.find((u) => u.username?.toLowerCase() === name) ?? null;
}

/** Called on every sign-in: creates the profile on first sign-in, refreshing
 *  the Google-provided name/picture each time. Username starts out null. */
export async function upsertFromGoogle(input: { id: string; email: string; name: string | null; image: string | null }): Promise<UserProfile> {
  const isAdmin = Boolean(ADMIN_EMAIL) && input.email.toLowerCase() === ADMIN_EMAIL;
  const users = await listUsers();
  const i = users.findIndex((u) => u.id === input.id);
  if (i < 0) {
    const profile: UserProfile = {
      id: input.id,
      email: input.email,
      name: input.name,
      image: input.image,
      username: null,
      isAdmin,
      createdAt: Date.now(),
    };
    await writeUsers([...users, profile]);
    return profile;
  }
  const profile: UserProfile = { ...users[i], email: input.email, name: input.name, image: input.image, isAdmin: users[i].isAdmin || isAdmin };
  const next = [...users];
  next[i] = profile;
  await writeUsers(next);
  return profile;
}

export class UsernameTakenError extends Error {}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function setUsername(id: string, raw: string): Promise<UserProfile> {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new Error("Usernames are 3-20 letters, numbers or underscores.");
  }
  if (username === ADMIN_PROFILE.username) throw new UsernameTakenError("That username is taken.");
  const users = await listUsers();
  if (users.some((u) => u.id !== id && u.username?.toLowerCase() === username)) {
    throw new UsernameTakenError("That username is taken.");
  }
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) throw new Error("Sign in again and retry.");
  const profile: UserProfile = { ...users[i], username };
  const next = [...users];
  next[i] = profile;
  await writeUsers(next);
  return profile;
}
