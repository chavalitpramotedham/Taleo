import { promises as fs } from "fs";
import path from "path";

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

async function blobRead<T>(pathname: string): Promise<T | null> {
  const url = blobUrl(pathname);
  if (!url) throw new Error("Blob token is malformed.");
  // Served from Blob's CDN (a cache hit costs nothing); overwriting a file
  // refreshes the cached copy within about a minute.
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  // Anything else (403 when the store is suspended or over its limits,
  // 5xx...) is a real failure - never pretend the file is simply missing.
  if (!res.ok) throw new Error(`Blob storage refused the read (${res.status} ${res.statusText}) for ${pathname}`);
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

export const readJson = async <T>(pathname: string) => {
  assertStorage();
  return useBlob ? blobRead<T>(pathname) : localRead<T>(pathname);
};
export const writeJson = async (pathname: string, data: unknown) => {
  assertStorage();
  return useBlob ? blobWrite(pathname, data) : localWrite(pathname, data);
};
export const deleteJson = async (pathname: string) => {
  assertStorage();
  return useBlob ? blobDelete(pathname) : localDelete(pathname);
};
