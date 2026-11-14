"use client";
import type { Story } from "./types";

/**
 * The stories kept on this device, paintings and all.
 *
 * They're kept in the browser's database (IndexedDB), one record a story.
 * They used to be one long string in its little key-value store
 * (localStorage), which a phone's browser allows only about 5MB: with a
 * painting on every page, half a dozen stories filled it, and the next one
 * couldn't be saved ("This device's storage is full"). The database has
 * room for hundreds of stories, and saving one story writes only that one.
 *
 * Reading stays instant: every story is read once into memory as the site
 * opens (`storiesReady`), and from then on read from there. Stories kept
 * the old way are moved over the first time, and the old store emptied.
 * Where the database can't be used (some private windows), the old way is
 * used instead.
 */

const LEGACY = "taleo.stories.v1";
const DB = "taleo";
const STORE = "stories";

/** Every story, once read from the database. */
let mem: Map<string, Story> | null = null;
/** Stories saved before the database was read (merged in once it is). */
const early = new Map<string, Story>();
/** Ids deleted before the database was read. */
const gone = new Set<string>();
let db: IDBDatabase | null = null;
/** The database can't be used here: the old store is used instead. */
let fallback = false;
let loading: Promise<void> | null = null;
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("taleo-stories") : null;

const withCompanions = (s: Story): Story => ({ ...s, companions: s.companions ?? [] });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no database"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("no database"));
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? (req as IDBRequest<T>).result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function legacyRead(): Story[] {
  try {
    const raw = window.localStorage.getItem(LEGACY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Story[]).map(withCompanions) : [];
  } catch {
    return [];
  }
}

/** Every story read into memory (once). Pages that open a story wait for
 *  this first; it's quick, and starts as soon as the site does. */
export function storiesReady(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return (loading ??= load());
}

async function load() {
  try {
    db = await openDb();
    const kept = ((await tx<Story[]>("readonly", (s) => s.getAll())) ?? []).map(withCompanions);
    const all = new Map(kept.map((s) => [s.id, s]));
    // (stories kept the old way: moved over, newest copy winning, then the
    // old store emptied - that's what frees the space)
    const legacy = legacyRead();
    if (legacy.length) {
      const moving = legacy.filter((s) => !all.has(s.id) || (s.updatedAt ?? 0) > (all.get(s.id)!.updatedAt ?? 0));
      if (moving.length) await tx("readwrite", (s) => void moving.forEach((st) => s.put(st)));
      for (const s of moving) all.set(s.id, s);
      try {
        window.localStorage.removeItem(LEGACY);
      } catch {}
    }
    for (const id of gone) all.delete(id);
    for (const [id, s] of early) all.set(id, s);
    mem = all;
    if (gone.size) void tx("readwrite", (s) => void gone.forEach((id) => s.delete(id))).catch(() => {});
    if (early.size) void put([...early.values()]);
    early.clear();
    gone.clear();
    channel?.addEventListener("message", (e) => void refresh((e.data as { id?: string })?.id));
  } catch {
    fallback = true;
    const all = new Map(legacyRead().map((s) => [s.id, s]));
    for (const id of gone) all.delete(id);
    for (const [id, s] of early) all.set(id, s);
    mem = all;
    if (early.size || gone.size) legacyWrite();
  }
  window.addEventListener("pagehide", flushStories);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushStories());
  window.dispatchEvent(new Event("taleo:stories"));
}

/** Another tab changed a story: read it again. */
async function refresh(id: string | undefined) {
  if (!id || !mem || !db) return;
  const s = await tx<Story>("readonly", (st) => st.get(id)).catch(() => undefined);
  if (s) mem.set(id, withCompanions(s));
  else mem.delete(id);
  window.dispatchEvent(new Event("taleo:stories"));
}

function put(stories: Story[]): Promise<boolean> {
  if (fallback) return Promise.resolve(legacyWrite());
  if (!db) return Promise.resolve(true);
  return tx("readwrite", (s) => void stories.forEach((st) => s.put(st)))
    .then(() => {
      for (const st of stories) channel?.postMessage({ id: st.id });
      return true;
    })
    .catch(() => false);
}

/** (where the database can't be used) */
function legacyWrite(): boolean {
  try {
    window.localStorage.setItem(LEGACY, JSON.stringify([...(mem?.values() ?? [])]));
    return true;
  } catch {
    return false;
  }
}

function readAll(): Story[] {
  if (typeof window === "undefined") return [];
  void storiesReady();
  if (mem) return [...mem.values()];
  // (before the database has been read: whatever's still in the old store,
  // and anything saved since)
  const all = new Map(legacyRead().map((s) => [s.id, s]));
  for (const id of gone) all.delete(id);
  for (const [id, s] of early) all.set(id, s);
  return [...all.values()];
}

function keep(story: Story) {
  if (mem) mem.set(story.id, story);
  else {
    early.set(story.id, story);
    gone.delete(story.id);
  }
}

// Stories saved "soon" (changing many times a second), written together.
const pending = new Map<string, Story>();
let waiting = 0;

/** Writes down anything saved "soon" that hasn't been written yet. */
export function flushStories() {
  // (not read in yet: they're written along with it)
  if (!pending.size || !mem || !(db || fallback)) return;
  window.clearTimeout(waiting);
  waiting = 0;
  const batch = [...pending.values()];
  pending.clear();
  void put(batch);
}

/** Saves a story that's changing many times a second (one being written:
 *  each page, each painting as it arrives). This tab sees the change at
 *  once; the database gets it a moment later, the changes of that moment
 *  in one write - and at once if the page is left. */
export function saveStorySoon(story: Story) {
  const s = { ...story, updatedAt: Date.now() };
  keep(s);
  pending.set(s.id, s);
  if (!waiting) waiting = window.setTimeout(flushStories, 400);
  window.dispatchEvent(new Event("taleo:stories"));
}

export const listStories = (): Story[] => readAll().sort((a, b) => b.updatedAt - a.updatedAt);

export const getStory = (id: string): Story | undefined => readAll().find((s) => s.id === id);

/** Saves a story now. False only where the old store is in use and full. */
export function saveStory(story: Story): boolean {
  const s = { ...story, updatedAt: Date.now() };
  pending.delete(s.id);
  keep(s);
  window.dispatchEvent(new Event("taleo:stories"));
  if (!mem) return true; // (written once the database is read)
  if (fallback) return legacyWrite();
  void put([s]);
  return true;
}

export function deleteStory(id: string) {
  pending.delete(id);
  if (mem) mem.delete(id);
  else {
    early.delete(id);
    gone.add(id);
  }
  window.dispatchEvent(new Event("taleo:stories"));
  if (!mem) return;
  if (fallback) return void legacyWrite();
  if (db) void tx("readwrite", (s) => void s.delete(id)).then(() => channel?.postMessage({ id }), () => {});
}

export const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

// (read in as soon as the site opens)
if (typeof window !== "undefined") void storiesReady();

// (development only: the store, to try by hand)
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __stories?: unknown }).__stories = { saveStory, getStory, listStories, deleteStory, storiesReady };
}
