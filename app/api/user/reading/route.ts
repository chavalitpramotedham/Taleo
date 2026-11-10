import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { logReadingDay, readingDiary, addReadingDays, type ReadingDiary } from "@/server/reading";
import { listGallery } from "@/server/gallery";
import { getUser, privateUserIds } from "@/server/users";

const ADMIN_LOGGED = ["2026-11-09", "2026-11-10"];
const NONE: ReadingDiary = { days: [], read: {} };

/**
 * Your reading diary, for the Home chart: the days you finished a story
 * (and which ones), when you joined, and when each of your own stories was
 * made (the chart puts those on their day too).
 *
 * `?ids=a,b,c` instead returns the library cards for those stories - what
 * a diary day shows when it's opened: your own, and other people's unless
 * they've since made their bookshelf private.
 */
export async function GET(req: Request) {
  const session = await auth();
  const ids = new URL(req.url).searchParams.get("ids");
  if (!session?.user?.id) return NextResponse.json(ids ? { stories: [] } : { days: [], joined: null, read: {}, made: [] });
  const id = session.user.id;
  const none = { headers: { "Cache-Control": "no-store" } };

  if (ids !== null) {
    const want = new Set(ids.split(",").filter(Boolean).slice(0, 40));
    const [all, hidden] = await Promise.all([listGallery().catch(() => []), privateUserIds().catch(() => new Set<string>())]);
    const stories = all.filter((e) => want.has(e.id) && (e.authorId === id || !hidden.has(e.authorId)));
    return NextResponse.json({ stories }, none);
  }

  const [kept, user, all] = await Promise.all([readingDiary(id).catch(() => NONE), getUser(id).catch(() => null), listGallery().catch(() => [])]);
  let diary = kept;
  // (one-off: the admin account's reads logged by hand - written once)
  if (session.user.isAdmin) diary = await addReadingDays(id, diary, ADMIN_LOGGED).catch(() => diary);
  const joined = user?.createdAt ? user.createdAt : null;
  const made = all.filter((e) => e.authorId === id).map((e) => ({ id: e.id, at: e.createdAt }));
  return NextResponse.json({ days: diary.days, read: diary.read, joined, made }, none);
}

/** Today counts as a reading day: { day: "YYYY-MM-DD", story?: id } in your
 *  own time zone. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { day?: unknown; story?: unknown } | null;
  const day = typeof body?.day === "string" ? body.day : "";
  const story = typeof body?.story === "string" ? body.story : undefined;
  // (only today or yesterday - a device's clock near midnight)
  const now = Date.now();
  const ok = [0, 1, -1].some((d) => new Date(now - d * 864e5).toISOString().slice(0, 10) === day);
  if (!ok) return NextResponse.json({ error: "That isn't today." }, { status: 400 });
  try {
    await logReadingDay(session.user.id, day, story);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't save that." }, { status: 503 });
  }
}
