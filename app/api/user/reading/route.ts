import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { logReadingDay, readingDays, addReadingDays } from "@/server/reading";
import { getUser } from "@/server/users";

const ADMIN_LOGGED = ["2026-11-09", "2026-11-10"];

/** The days you've read together (for the Home chart), and when you joined. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ days: [], joined: null });
  const id = session.user.id;
  const [read, user] = await Promise.all([readingDays(id).catch(() => [] as string[]), getUser(id).catch(() => null)]);
  let days = read;
  // (one-off: the admin account's reads logged by hand - written once)
  if (session.user.isAdmin) days = await addReadingDays(id, days, ADMIN_LOGGED).catch(() => days);
  const joined = user?.createdAt ? user.createdAt : null;
  return NextResponse.json({ days, joined }, { headers: { "Cache-Control": "no-store" } });
}

/** Today counts as a reading day: { day: "YYYY-MM-DD" } in your own time zone. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { day?: unknown } | null;
  const day = typeof body?.day === "string" ? body.day : "";
  // (only today or yesterday - a device's clock near midnight)
  const now = Date.now();
  const ok = [0, 1, -1].some((d) => new Date(now - d * 864e5).toISOString().slice(0, 10) === day);
  if (!ok) return NextResponse.json({ error: "That isn't today." }, { status: 400 });
  try {
    await logReadingDay(session.user.id, day);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't save that." }, { status: 503 });
  }
}
