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

async function blobRead<T>(pathname: string): Promise<T | null> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: pathname, token: BLOB_TOKEN, limit: 1 });
  const blob = blobs.find((b) => b.pathname === pathname);
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  return res.ok ? ((await res.json()) as T) : null;
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
  const { list, del } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: pathname, token: BLOB_TOKEN, limit: 1 });
  const blob = blobs.find((b) => b.pathname === pathname);
  if (blob) await del(blob.url, { token: BLOB_TOKEN });
}

export const readJson = <T>(pathname: string) => (useBlob ? blobRead<T>(pathname) : localRead<T>(pathname));
export const writeJson = (pathname: string, data: unknown) => (useBlob ? blobWrite(pathname, data) : localWrite(pathname, data));
export const deleteJson = (pathname: string) => (useBlob ? blobDelete(pathname) : localDelete(pathname));
