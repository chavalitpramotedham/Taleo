import { promises as fs } from "fs";
import path from "path";
import { reportError } from "./alerts";

/**
 * Shared JSON-blob storage for what is published: the library's stories,
 * their ratings and comments. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN
 * is set (production), and local JSON files otherwise, so everything still
 * works offline in dev without any cloud credentials.
 *
 * Every file here is PUBLIC: anyone who has its address can read it, and
 * the addresses are easy to work out. Nothing about an account belongs
 * here - profiles, usage, saved characters and the like are kept in
 * server/private-store.
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

async function blobDeletePrefix(prefix: string): Promise<number> {
  const { list, del } = await import("@vercel/blob");
  let removed = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 500, token: BLOB_TOKEN });
    const found = page.blobs.filter((b) => b.pathname.startsWith(prefix));
    if (found.length) await del(found.map((b) => b.url), { token: BLOB_TOKEN });
    removed += found.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return removed;
}

async function localDeletePrefix(prefix: string): Promise<number> {
  // (a folder, or one file)
  const target = localFile(prefix);
  const walk = async (dir: string): Promise<string[]> => {
    const here = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    return (await Promise.all(here.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])))).flat();
  };
  const files = prefix.endsWith("/") ? await walk(target) : (await fs.stat(target).then((st) => st.isFile(), () => false)) ? [target] : [];
  await Promise.all(files.map((f) => fs.unlink(f).catch(() => {})));
  return files.length;
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
/** Removes every file whose name begins with `prefix` (a folder, with its
 *  trailing slash, or one file's whole name); says how many there were.
 *  It asks the store for a listing - a metered operation - so it is for
 *  one-off housekeeping only, never a page. */
export const deletePrefix = async (prefix: string): Promise<number> => {
  assertStorage();
  if (!prefix || prefix === "/") throw new Error("Not a folder to clear.");
  return useBlob ? blobDeletePrefix(prefix) : localDeletePrefix(prefix);
};
