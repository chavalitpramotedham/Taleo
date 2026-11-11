import { promises as fs } from "fs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import path from "path";
import { reportError } from "./alerts";

/**
 * Shared JSON-blob storage used by the public story store and the user
 * store. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production),
 * and local JSON files otherwise, so everything still works offline in dev
 * without any cloud credentials.
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const useBlob = Boolean(BLOB_TOKEN);

// On Vercel there is no writable disk, so running without the Blob token
// means every read looks empty (an "empty" library) and every write fails
// (sign-in can't save a profile). Fail loudly instead of quietly.
const onVercel = Boolean(process.env.VERCEL);
function assertStorage() {
  if (!useBlob && onVercel) {
    const msg = "[store] BLOB_READ_WRITE_TOKEN is not set for this deployment: connect the Blob store to the project and redeploy.";
    console.error(msg);
    throw new Error(msg);
  }
}

const DATA_DIR = path.join(process.cwd(), ".data");
const localFile = (pathname: string) => path.join(DATA_DIR, pathname);

async function localRead<T>(pathname: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(localFile(pathname), "utf8")) as T;
  } catch {
    return null;
  }
}

async function localWrite(pathname: string, data: unknown) {
  const file = localFile(pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
}

/** A public blob's address, worked out from the store id in the token
 *  ("vercel_blob_rw_<storeId>_<secret>"). Reading it directly costs no
 *  Blob operation at all - unlike list(), an "advanced" operation with a
 *  small monthly allowance, which used to run before every single read. */
export function blobUrl(pathname: string): string | null {
  const storeId = BLOB_TOKEN?.split("_")[3];
  return storeId ? `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${pathname}` : null;
}

async function blobRead<T>(pathname: string, cacheSeconds?: number, fresh?: boolean): Promise<T | null> {
  const base = blobUrl(pathname);
  if (!base) throw new Error("Blob token is malformed.");
  // `fresh`: skip the CDN's copy (for a file that changes often and must be
  // current, e.g. an unfinished story) - costs one cheap uncached read.
  const url = fresh ? `${base}?v=${Date.now()}` : base;
  // Served from Blob's CDN (a cache hit costs nothing); overwriting a file
  // refreshes the cached copy within about a minute. Normally always fresh
  // (writes read-modify-write); pages that are themselves cached pass
  // cacheSeconds so they can be served from Vercel's cache.
  const res = await fetch(url, cacheSeconds ? { next: { revalidate: cacheSeconds } } : { cache: "no-store" });
  if (res.status === 404) return null;
  // Anything else (403 when the store is suspended or over its limits,
  // 5xx...) is a real failure - never pretend the file is simply missing.
  if (!res.ok) {
    const err = new Error(`Blob storage refused the read (${res.status} ${res.statusText}) for ${pathname}`);
    await reportError("storage", err);
    throw err;
  }
  return (await res.json()) as T;
}

async function blobWrite(pathname: string, data: unknown) {
  const { put } = await import("@vercel/blob");
  await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: BLOB_TOKEN,
  });
}

async function localDelete(pathname: string) {
  try {
    await fs.unlink(localFile(pathname));
  } catch {}
}

async function blobDelete(pathname: string) {
  const { del } = await import("@vercel/blob");
  const url = blobUrl(pathname);
  if (url) await del(url, { token: BLOB_TOKEN });
}

export const readJson = async <T>(pathname: string, opts: { cacheSeconds?: number; fresh?: boolean } = {}) => {
  assertStorage();
  return useBlob ? blobRead<T>(pathname, opts.cacheSeconds, opts.fresh) : localRead<T>(pathname);
};
export const writeJson = async (pathname: string, data: unknown) => {
  assertStorage();
  return useBlob ? blobWrite(pathname, data) : localWrite(pathname, data);
};
export const deleteJson = async (pathname: string) => {
  assertStorage();
  return useBlob ? blobDelete(pathname) : localDelete(pathname);
};

// ------------------------------------------------------------ private files
//
// Anything that says who someone is, or what one family did (the account
// list with its email addresses, a family's characters, reading diary,
// saved stories, allowance counts, messages sent to us), is kept "private":
// under a name nobody can work out, and encrypted with a key only the
// server holds. The storage itself hands any file to whoever asks for it
// by name, so the name alone is not protection enough for these: even
// with the address, what comes back can't be read.
//
// The key and the names come from TALEO_DATA_SECRET - or, without it,
// AUTH_SECRET. Once TALEO_DATA_SECRET is set (to any long random value of
// its own), files kept under the AUTH_SECRET key are read with that key
// one last time and saved again under the new one; when they have all
// been moved (rekeyPrivateFiles, see account-data.ts), AUTH_SECRET can be
// changed freely. TALEO_DATA_SECRET itself must then never change or be
// lost: without it nothing private can be read.

interface Keys {
  key: Buffer;
  name: (pathname: string) => string;
  /** A name nobody can work out, for a file of another kind (a draft). */
  hidden: (what: string) => string;
}
const keysFrom = (secret: string): Keys => ({
  key: createHash("sha256").update(`${secret}:taleo-private-key`).digest(),
  name: (pathname) => `private/${createHash("sha256").update(`${secret}:taleo-private-name:${pathname}`).digest("hex").slice(0, 48)}.json`,
  hidden: (what) => createHash("sha256").update(`${secret}:${what}`).digest("hex").slice(0, 40),
});
const AUTH = process.env.AUTH_SECRET || "taleo-dev";
const OWN = process.env.TALEO_DATA_SECRET || "";
const NOW = keysFrom(OWN || AUTH);
/** The keys from before TALEO_DATA_SECRET was set, while files may still be under them. */
const BEFORE: Keys | null = OWN && OWN !== AUTH ? keysFrom(AUTH) : null;
/** Whether private files have a secret of their own (not AUTH_SECRET's). */
export const hasOwnDataSecret = Boolean(BEFORE);
/** Unguessable names for a file kept unencrypted (an unfinished story):
 *  the one to use, and the one it may still be under from before. */
export const hiddenName = (what: string) => ({ now: NOW.hidden(what), before: BEFORE ? BEFORE.hidden(what) : null });

interface Sealed {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}
function seal(data: unknown, k: Keys = NOW): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k.key, iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: body.toString("base64") };
}
function unseal<T>(s: Sealed, k: Keys = NOW): T {
  const d = createDecipheriv("aes-256-gcm", k.key, Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8")) as T;
}

// Files are moved (from the open, or from the old key) only by the real
// site: a preview deployment with different secrets must never take them
// away from it.
const mayMove = !onVercel || process.env.VERCEL_ENV === "production";

/** Notes left (as private files) once a one-off move is complete, so
 *  nothing need be looked for in the old place. Asked once per server. */
const SWEPT = "migrations/plain-files-moved";
const REKEYED = "migrations/rekeyed";
const done = new Map<string, Promise<boolean>>();
const isDone = (note: string) => {
  let p = done.get(note);
  if (!p) {
    p = readJson<Sealed>(NOW.name(note), { fresh: true })
      .then(Boolean)
      .catch(() => false);
    // (not yet: ask again next time, it may be done by then)
    void p.then((yes) => !yes && done.delete(note));
    done.set(note, p);
  }
  return p;
};
async function noteDone(note: string, about: unknown) {
  await writeJson(NOW.name(note), seal(about));
  done.set(note, Promise.resolve(true));
}
export const notePlainFilesMoved = (about: unknown) => noteDone(SWEPT, about);
export const noteRekeyed = (about: unknown) => noteDone(REKEYED, about);
export const plainFilesMoved = () => isDone(SWEPT);
/** Nothing is left under the old key (or there never was one). */
export const rekeyed = async () => !BEFORE || (await isDone(REKEYED));

/** Writes the private copy, makes sure it reads back, and only then takes
 *  the old one (given by its stored name) away. */
async function moveIn(pathname: string, data: unknown, oldName: string) {
  const name = NOW.name(pathname);
  await writeJson(name, seal(data));
  const back = await readJson<Sealed>(name, { fresh: true });
  if (!back || JSON.stringify(unseal(back)) !== JSON.stringify(data)) throw new Error(`The private copy of ${pathname} didn't read back: the old one was left alone.`);
  await deleteJson(oldName).catch((e) => console.error(`[store] couldn't remove the old copy of ${pathname}`, e));
}

/** A private file as kept under the old key, if it's still there. */
async function readBefore<T>(pathname: string): Promise<{ data: T } | null> {
  if (!BEFORE || (await isDone(REKEYED))) return null;
  const old = await readJson<Sealed>(BEFORE.name(pathname), { fresh: true });
  return old ? { data: unseal<T>(old, BEFORE) } : null;
}

export async function readPrivate<T>(pathname: string, opts: { cacheSeconds?: number; fresh?: boolean } = {}): Promise<T | null> {
  const name = NOW.name(pathname);
  let sealed = await readJson<Sealed>(name, opts);
  // (not there, says a cached answer: make sure before believing it)
  if (!sealed && !opts.fresh && useBlob) sealed = await readJson<Sealed>(name, { fresh: true });
  if (sealed) return unseal<T>(sealed);
  const old = await readBefore<T>(pathname);
  if (old) {
    if (mayMove) await moveIn(pathname, old.data, BEFORE!.name(pathname));
    return old.data;
  }
  if (await isDone(SWEPT)) return null;
  // (the note that plain files were moved may itself be under the old key)
  if (BEFORE && !(await isDone(REKEYED)) && (await readJson<Sealed>(BEFORE.name(SWEPT), { fresh: true }).catch(() => null))) return null;
  const plain = await readJson<T>(pathname, { fresh: true });
  if (plain === null) return null;
  if (mayMove) await moveIn(pathname, plain, pathname);
  return plain;
}
/** Moves one plain file into private storage - or, if its private copy is
 *  already there (the newer of the two), just removes the plain one. */
export async function movePlain(pathname: string) {
  if (!mayMove) return;
  if ((await readJson<Sealed>(NOW.name(pathname), { fresh: true })) || (await readBefore(pathname))) return deleteJson(pathname);
  const plain = await readJson<unknown>(pathname, { fresh: true });
  if (plain !== null) await moveIn(pathname, plain, pathname);
}
export async function writePrivate(pathname: string, data: unknown) {
  await writeJson(NOW.name(pathname), seal(data));
  // (a copy under the old key would now be out of date: never read again,
  // since the new one is found first - but there's no reason to keep it)
  if (BEFORE && mayMove && !(await isDone(REKEYED))) await deleteJson(BEFORE.name(pathname)).catch(() => {});
}
/** Removes a private file (and any older copy of it). */
export async function deletePrivate(pathname: string) {
  await Promise.all([deleteJson(NOW.name(pathname)), BEFORE ? deleteJson(BEFORE.name(pathname)).catch(() => {}) : null, deleteJson(pathname).catch(() => {})]);
}

/** Every plain file under a folder, and when it was last written (for
 *  the one-off move). */
export async function listPlain(prefix: string): Promise<{ pathname: string; at: number }[]> {
  assertStorage();
  if (!useBlob) {
    const walk = async (dir: string): Promise<{ pathname: string; at: number }[]> => {
      const out: { pathname: string; at: number }[] = [];
      for (const e of await fs.readdir(localFile(dir), { withFileTypes: true }).catch(() => [])) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) out.push(...(await walk(p)));
        else out.push({ pathname: p, at: (await fs.stat(localFile(p))).mtimeMs });
      }
      return out;
    };
    return walk(prefix.replace(/\/$/, ""));
  }
  const { list } = await import("@vercel/blob");
  const out: { pathname: string; at: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000, token: BLOB_TOKEN });
    out.push(...page.blobs.map((b) => ({ pathname: b.pathname, at: new Date(b.uploadedAt).getTime() })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}
export const canMovePlainFiles = mayMove;
