import { promises as fs } from "fs";
import path from "path";
import { allPages } from "@/lib/story-utils";
import type { GalleryEntry, Story } from "@/lib/types";

/**
 * The public story store (no accounts: everything published lives under one
 * shared "shelf"). Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (production), and local JSON files otherwise, so the feature works offline
 * in dev the same way the rest of the app does without an API key.
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const useBlob = Boolean(BLOB_TOKEN);

const INDEX_PATH = "gallery/index.json";
const storyPath = (id: string) => `gallery/stories/${id}.json`;

const DATA_DIR = path.join(process.cwd(), ".data", "gallery");
const localFile = (pathname: string) => path.join(DATA_DIR, pathname.replace(/^gallery\//, ""));

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

const readJson = <T>(pathname: string) => (useBlob ? blobRead<T>(pathname) : localRead<T>(pathname));
const writeJson = (pathname: string, data: unknown) => (useBlob ? blobWrite(pathname, data) : localWrite(pathname, data));

export async function listGallery(): Promise<GalleryEntry[]> {
  return (await readJson<GalleryEntry[]>(INDEX_PATH)) ?? [];
}

export async function getGalleryStory(id: string): Promise<Story | null> {
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  return readJson<Story>(storyPath(id));
}

/** Publish (or re-publish) a finished story to the public store. */
export async function publishStory(story: Story): Promise<GalleryEntry> {
  const entry: GalleryEntry = {
    id: story.id,
    title: story.title || "An untitled story",
    createdAt: story.createdAt,
    rating: story.rating,
    age: story.age,
    heroName: story.hero.name,
    cover: allPages(story).find((p) => p.svg)?.svg ?? null,
  };
  const index = await listGallery();
  const next = [entry, ...index.filter((e) => e.id !== story.id)];
  await Promise.all([writeJson(INDEX_PATH, next), writeJson(storyPath(story.id), story)]);
  return entry;
}
