import { promises as fs } from "fs";
import path from "path";
import { metricsEnabled, pipeline } from "./metrics";

/**
 * One story is made at a time, on one device at a time.
 *
 * While a story is being made (from "Create story" until it's finished,
 * thrown away, or left alone), the device making it holds the account's
 * "story session": it says so every little while, and the note runs out
 * by itself shortly after it stops saying so. Another device can't begin
 * a story while the note is fresh; once the first has left the story (or
 * simply gone quiet), it can.
 *
 * A device is a browser (the same in all its tabs), known by an id it
 * made up for itself - not a secret, only a way to tell "this one" from
 * "another one".
 */

/** How long a device's claim lasts without being renewed (it renews every
 *  40 seconds or so while the story is open and the page is in view). */
const HOLD_S = 100;
const key = (userId: string) => `ss:${userId}`;
const okId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{8,64}$/.test(v);
export const deviceOf = (req: Request): string | null => {
  const v = req.headers.get("x-taleo-device");
  return okId(v) ? v : null;
};

// ---- a developer's machine: a file
const onVercel = Boolean(process.env.VERCEL);
const file = (userId: string) => path.join(process.cwd(), ".data", "story-session", `${userId.replace(/[^\w-]/g, "")}.json`);
type Note = { device: string; at: number };
async function readNote(userId: string): Promise<Note | null> {
  if (metricsEnabled()) {
    const [raw] = await pipeline([["GET", key(userId)]]);
    if (!raw) return null;
    try {
      return (typeof raw === "string" ? JSON.parse(raw) : raw) as Note;
    } catch {
      return null;
    }
  }
  if (onVercel) return null;
  try {
    const n = JSON.parse(await fs.readFile(file(userId), "utf8")) as Note;
    return Date.now() - n.at < HOLD_S * 1000 ? n : null;
  } catch {
    return null;
  }
}
async function writeNote(userId: string, note: Note | null) {
  if (metricsEnabled()) {
    await pipeline([note ? ["SET", key(userId), JSON.stringify(note), "EX", HOLD_S] : ["DEL", key(userId)]]);
    return;
  }
  if (onVercel) return;
  if (!note) return void (await fs.unlink(file(userId)).catch(() => {}));
  await fs.mkdir(path.dirname(file(userId)), { recursive: true });
  await fs.writeFile(file(userId), JSON.stringify(note));
}

/** Is another device making a story on this account right now? (Never
 *  "yes" on a guess: if it can't be found out, nobody is.) */
export async function busyElsewhere(userId: string, device: string | null): Promise<boolean> {
  if (!device) return false;
  const note = await readNote(userId).catch(() => null);
  return Boolean(note && note.device !== device);
}

/** This device says it is making a story (or still is). False if another
 *  device holds the session. */
export async function claimStorySession(userId: string, device: string | null): Promise<boolean> {
  if (!device) return true; // (an older page that doesn't say who it is: let through)
  try {
    const note = await readNote(userId);
    if (note && note.device !== device) return false;
    await writeNote(userId, { device, at: Date.now() });
  } catch (e) {
    console.error("[story-session] couldn't keep the note", e);
  }
  return true;
}

/** This device has left the story (or the story is gone): the session is
 *  free. With `anyone`, whoever held it (the story was thrown away). */
export async function releaseStorySession(userId: string, device: string | null, anyone = false): Promise<void> {
  try {
    if (!anyone) {
      const note = await readNote(userId);
      if (!note || note.device !== device) return;
    }
    await writeNote(userId, null);
  } catch {}
}

export const BUSY_ELSEWHERE = "A story is being made on another device right now. Finish or discard it there first - or, if you've left it, try again in a minute or two.";
