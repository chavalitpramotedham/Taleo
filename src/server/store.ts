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
// The key and the names come from TALEO_DATA_SECRET (or, without it,
// AUTH_SECRET). CHANGING THAT SECRET MAKES EVERY PRIVATE FILE UNREADABLE -
// set TALEO_DATA_SECRET first if AUTH_SECRET ever has to change.

const DATA_SECRET = process.env.TALEO_DATA_SECRET || process.env.AUTH_SECRET || "taleo-dev";
const DATA_KEY = createHash("sha256").update(`${DATA_SECRET}:taleo-private-key`).digest();
const privateName = (pathname: string) => `private/${createHash("sha256").update(`${DATA_SECRET}:taleo-private-name:${pathname}`).digest("hex").slice(0, 48)}.json`;

interface Sealed {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}
function seal(data: unknown): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", DATA_KEY, iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: body.toString("base64") };
}
function unseal<T>(s: Sealed): T {
  const d = createDecipheriv("aes-256-gcm", DATA_KEY, Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8")) as T;
}

// Files written before this existed sit in the open under their plain
// names. They're moved the first time they're read (and all at once by
// sweepPlainFiles) - but only by the real site: a preview deployment with
// a different secret must never take them away from it.
const mayMove = !onVercel || process.env.VERCEL_ENV === "production";

/** Once every plain file has been moved (sweepPlainFiles leaves a note
 *  saying so), there's no need to look for one. Asked once per server. */
const SWEPT = "migrations/plain-files-moved";
let swept: Promise<boolean> | null = null;
const plainFilesGone = () =>
  (swept ??= readJson<Sealed>(privateName(SWEPT), { fresh: true })
    .then(Boolean)
    .catch(() => false));
export async function notePlainFilesMoved(note: unknown) {
  await writePrivate(SWEPT, note);
  swept = Promise.resolve(true);
}

export async function readPrivate<T>(pathname: string, opts: { cacheSeconds?: number; fresh?: boolean } = {}): Promise<T | null> {
  const name = privateName(pathname);
  let sealed = await readJson<Sealed>(name, opts);
  // (not there, says a cached answer: make sure before believing it)
  if (!sealed && !opts.fresh && useBlob) sealed = await readJson<Sealed>(name, { fresh: true });
  if (sealed) return unseal<T>(sealed);
  if (await plainFilesGone()) return null;
  const plain = await readJson<T>(pathname, { fresh: true });
  if (plain === null) return null;
  if (mayMove) await moveIn(pathname, plain);
  return plain;
}
/** Writes the private copy, makes sure it reads back, and only then takes
 *  the plain one away. */
async function moveIn(pathname: string, plain: unknown) {
  const name = privateName(pathname);
  await writeJson(name, seal(plain));
  const back = await readJson<Sealed>(name, { fresh: true });
  if (!back || JSON.stringify(unseal(back)) !== JSON.stringify(plain)) throw new Error(`The private copy of ${pathname} didn't read back: the plain one was left alone.`);
  await deleteJson(pathname).catch((e) => console.error(`[store] couldn't remove the plain copy of ${pathname}`, e));
}
/** Moves one plain file into private storage - or, if its private copy is
 *  already there (the newer of the two), just removes the plain one. */
export async function movePlain(pathname: string) {
  if (!mayMove) return;
  if (await readJson<Sealed>(privateName(pathname), { fresh: true })) return deleteJson(pathname);
  const plain = await readJson<unknown>(pathname, { fresh: true });
  if (plain !== null) await moveIn(pathname, plain);
}
export async function writePrivate(pathname: string, data: unknown) {
  await writeJson(privateName(pathname), seal(data));
}
/** Removes a private file (and any plain copy from before). */
export async function deletePrivate(pathname: string) {
  await Promise.all([deleteJson(privateName(pathname)), deleteJson(pathname).catch(() => {})]);
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
