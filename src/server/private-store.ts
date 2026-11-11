import { promises as fs } from "fs";
import path from "path";
import { metricsEnabled, pipeline, type Cmd } from "./metrics";
import { deleteJson, readJson } from "./store";

/**
 * The private store: where anything about an account is kept that nobody
 * else may read - its profile (email address, plan), its usage counts, its
 * saved characters, its bookshelf and reading diary, messages sent to us.
 *
 * The file store (server/store) is publicly readable by address: right for
 * published stories, wrong for these. So they live in Redis (the same
 * private store the billing records and the metrics use), which is only
 * reachable with the server's token:
 *
 *  - one record per key - nothing is a whole-list rewrite, so two people
 *    signing up at once can't lose one of them;
 *  - a record changes only if it is still what was read (`commit`'s
 *    `check`): a change made from an out-of-date copy is refused and tried
 *    again, never written over someone else's;
 *  - a read is the record as it is now - there's no CDN copy lagging
 *    behind a write.
 *
 * Without Redis: on a developer's machine the same records are files under
 * .data/private/, so everything works with no cloud credentials. On a
 * deployed site it fails loudly - there is nowhere private to keep them.
 *
 * Moving over from the file store: until the old files are retired (see
 * server/account-move), a record that isn't here yet is looked for at its
 * old address and copied across the first time it's asked for - so the
 * site can be deployed before, during or after the copy.
 */

const onVercel = Boolean(process.env.VERCEL);
const useRedis = () => metricsEnabled();
/** Whether there is anywhere private to keep records in this deployment. */
export const privateStoreAvailable = () => useRedis() || !onVercel;
function assertAvailable() {
  if (!privateStoreAvailable()) {
    const msg = "[private-store] Redis isn't connected to this deployment (KV_REST_API_URL / KV_REST_API_TOKEN): account records have nowhere private to live. Connect Upstash Redis to the project and redeploy.";
    console.error(msg);
    throw new Error(msg);
  }
}

/** One all-or-nothing change: it happens only if every `check` still
 *  holds (the key holds exactly this text; null = the key is absent). */
export interface Tx {
  check?: [key: string, raw: string | null][];
  set?: [key: string, raw: string, ttlSeconds?: number][];
  del?: string[];
  sadd?: [setKey: string, member: string][];
  srem?: [setKey: string, member: string][];
}

// KEYS: checked, set, deleted, added-to, removed-from (in that order).
// ARGV: the five counts, then for each check (present?, text), for each
// set (text, ttl), for each add and remove (member).
const COMMIT = `
local nc, ns, nd, na, nr = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5])
local k, a = 1, 6
for i = 1, nc do
  local cur = redis.call('GET', KEYS[k])
  if ARGV[a] == '0' then
    if cur then return 0 end
  elseif cur ~= ARGV[a + 1] then
    return 0
  end
  k = k + 1
  a = a + 2
end
for i = 1, ns do
  local ttl = tonumber(ARGV[a + 1])
  if ttl > 0 then redis.call('SET', KEYS[k], ARGV[a], 'EX', ttl) else redis.call('SET', KEYS[k], ARGV[a]) end
  k = k + 1
  a = a + 2
end
for i = 1, nd do
  redis.call('DEL', KEYS[k])
  k = k + 1
end
for i = 1, na do
  redis.call('SADD', KEYS[k], ARGV[a])
  k = k + 1
  a = a + 1
end
for i = 1, nr do
  redis.call('SREM', KEYS[k], ARGV[a])
  k = k + 1
  a = a + 1
end
return 1`;

function commitCmd(tx: Tx): Cmd {
  const check = tx.check ?? [];
  const set = tx.set ?? [];
  const del = tx.del ?? [];
  const sadd = tx.sadd ?? [];
  const srem = tx.srem ?? [];
  const keys = [...check.map((c) => c[0]), ...set.map((s) => s[0]), ...del, ...sadd.map((s) => s[0]), ...srem.map((s) => s[0])];
  const args: (string | number)[] = [check.length, set.length, del.length, sadd.length, srem.length];
  for (const [, raw] of check) args.push(raw === null ? "0" : "1", raw ?? "");
  for (const [, raw, ttl] of set) args.push(raw, Math.max(0, Math.floor(ttl ?? 0)));
  for (const [, m] of sadd) args.push(m);
  for (const [, m] of srem) args.push(m);
  return ["EVAL", COMMIT, keys.length, ...keys, ...args];
}

const text = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));

// ---- a developer's machine: one file per key under .data/private/
const LOCAL_DIR = path.join(process.cwd(), ".data", "private");
function localFile(key: string) {
  const safe = key.replace(/[^\w.\-/:]/g, "_").replace(/:/g, "/").replace(/\.\.+/g, "_");
  return path.join(LOCAL_DIR, `${safe}.kv`);
}
async function localGet(key: string): Promise<string | null> {
  try {
    return await fs.readFile(localFile(key), "utf8");
  } catch {
    return null;
  }
}
async function localPut(key: string, raw: string) {
  const file = localFile(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // (written beside it and moved into place: a reader never sees half a file)
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, raw);
  await fs.rename(tmp, file);
}
const localSet = async (key: string): Promise<string[]> => {
  try {
    const v = JSON.parse((await localGet(key)) ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
// (one change at a time on this server; pages and API routes can be
// separate programs in development, which is as good as a laptop needs)
let localTurn: Promise<unknown> = Promise.resolve();
const localInTurn = <T>(work: () => Promise<T>): Promise<T> => {
  const run = localTurn.then(work, work);
  localTurn = run.catch(() => {});
  return run;
};
async function localCommit(tx: Tx): Promise<boolean> {
  for (const [key, raw] of tx.check ?? []) if ((await localGet(key)) !== raw) return false;
  for (const [key, raw] of tx.set ?? []) await localPut(key, raw);
  for (const key of tx.del ?? []) await fs.unlink(localFile(key)).catch(() => {});
  for (const [key, m] of tx.sadd ?? []) {
    const cur = await localSet(key);
    if (!cur.includes(m)) await localPut(key, JSON.stringify([...cur, m]));
  }
  for (const [key, m] of tx.srem ?? []) {
    const cur = await localSet(key);
    if (cur.includes(m)) await localPut(key, JSON.stringify(cur.filter((x) => x !== m)));
  }
  return true;
}

// ------------------------------------------------------------ the records

const CHUNK = 200;

/** The text held at each key (null: nothing there). */
export async function getRaw(keys: string[], opts: { cacheSeconds?: number } = {}): Promise<(string | null)[]> {
  assertAvailable();
  if (!keys.length) return [];
  if (!useRedis()) return Promise.all(keys.map(localGet));
  const out: (string | null)[] = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const [found] = await pipeline([["MGET", ...keys.slice(i, i + CHUNK)]], { strict: true, cacheSeconds: opts.cacheSeconds });
    if (!Array.isArray(found)) throw new Error("The private store gave an answer that can't be read.");
    out.push(...found.map(text));
  }
  return out;
}

/** The members of a set. */
export async function members(setKey: string, opts: { cacheSeconds?: number } = {}): Promise<string[]> {
  assertAvailable();
  if (!useRedis()) return localSet(setKey);
  const [found] = await pipeline([["SMEMBERS", setKey]], { strict: true, cacheSeconds: opts.cacheSeconds });
  return Array.isArray(found) ? found.map(String) : [];
}

/** Makes each change, each all-or-nothing; says which ones happened. */
export async function commitAll(txs: Tx[]): Promise<boolean[]> {
  assertAvailable();
  if (!txs.length) return [];
  if (!useRedis()) return localInTurn(async () => {
    const done: boolean[] = [];
    for (const tx of txs) done.push(await localCommit(tx));
    return done;
  });
  const done: boolean[] = [];
  for (let i = 0; i < txs.length; i += CHUNK) {
    const out = await pipeline(txs.slice(i, i + CHUNK).map(commitCmd), { strict: true });
    done.push(...out.map((r) => Number(r) === 1));
  }
  return done;
}
export const commit = async (tx: Tx) => (await commitAll([tx]))[0];

/** Before trying a refused change again: a short wait, a little longer
 *  each time and never the same twice, so several writers held up by one
 *  another don't all come back at the same instant. */
export const retryPause = (attempt: number) => (attempt ? new Promise<void>((r) => setTimeout(r, Math.random() * 15 * attempt)) : Promise.resolve());

// ----------------------------------------- documents moved from the files

/** Set once the old public files have been removed: nothing is looked for
 *  at an old address after that. */
export const RETIRED_KEY = "legacy:retired";
let retiredSeen = false;
const docKey = (pathname: string) => `doc:${pathname}`;

/** Whether the old public files have been retired. */
export async function legacyRetired(): Promise<boolean> {
  if (retiredSeen) return true;
  const [flag] = await getRaw([RETIRED_KEY]);
  if (flag !== null) retiredSeen = true;
  return retiredSeen;
}

/** Records that the old public files are gone (the move's last step). */
export async function markLegacyRetired(): Promise<void> {
  await commit({ set: [[RETIRED_KEY, String(Date.now())]] });
  retiredSeen = true;
}

/** The record's text - found here, or (until the old files are retired)
 *  at its old address in the file store, and then copied across. */
async function docRaw(pathname: string): Promise<string | null> {
  const [raw, flag] = await getRaw(retiredSeen ? [docKey(pathname)] : [docKey(pathname), RETIRED_KEY]);
  if (flag !== null && flag !== undefined) retiredSeen = true;
  if (raw !== null || retiredSeen) return raw;
  const old = await readJson<unknown>(pathname, { fresh: true });
  if (old === null || old === undefined) return null;
  const copied = JSON.stringify(old);
  // (only if nothing has been saved here in the meantime)
  if (await commit({ check: [[docKey(pathname), null]], set: [[docKey(pathname), copied]] })) return copied;
  return (await getRaw([docKey(pathname)]))[0];
}

/** A private record, by the name its file used to have (null: none). */
export async function readPrivate<T>(pathname: string): Promise<T | null> {
  const raw = await docRaw(pathname);
  return raw === null ? null : (JSON.parse(raw) as T);
}

/** Saves a private record whole. `ttlSeconds`: forgotten by the store
 *  itself after that long without being saved again. */
export async function writePrivate(pathname: string, data: unknown, opts: { ttlSeconds?: number } = {}): Promise<void> {
  await commit({ set: [[docKey(pathname), JSON.stringify(data), opts.ttlSeconds]] });
}

/**
 * Changes a private record from what it is now: `change` is given the
 * record as it stands (null: none) and returns what it should become
 * (undefined: leave it be). If someone else saved it in between, it is
 * read again and `change` is asked again - nothing is written over.
 */
export async function updatePrivate<T>(pathname: string, change: (current: T | null) => T | undefined, opts: { ttlSeconds?: number } = {}): Promise<T | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await retryPause(attempt);
    const raw = await docRaw(pathname);
    const current = raw === null ? null : (JSON.parse(raw) as T);
    const next = change(current);
    if (next === undefined) return current;
    if (await commit({ check: [[docKey(pathname), raw]], set: [[docKey(pathname), JSON.stringify(next), opts.ttlSeconds]] })) return next;
  }
  throw new Error("Couldn't save that just now. Please try again.");
}

/** Removes a private record (and, until they're retired, its old public
 *  file - or it would come back the next time it was asked for). */
export async function deletePrivate(pathname: string): Promise<void> {
  const retired = await legacyRetired();
  await commit({ del: [docKey(pathname)] });
  if (!retired) await deleteJson(pathname).catch((e) => console.error("[private-store] couldn't remove an old file", pathname, e));
}

/** Which of these records are already here (for the move's own checks). */
export async function privateHas(pathnames: string[]): Promise<boolean[]> {
  return (await getRaw(pathnames.map(docKey))).map((r) => r !== null);
}

/** The private records kept per account, by the names their files had. */
export const ACCOUNT_DOCS = {
  characters: (userId: string) => `characters/${userId}.json`,
  saved: (userId: string) => `users/saved/${userId}.json`,
  reading: (userId: string) => `users/reading/${userId}.json`,
  parkedCharacter: (userId: string) => `pending/character/${userId}.json`,
  usage: (userId: string) => `ratelimits/${userId}.json`,
} as const;
