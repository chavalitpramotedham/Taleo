import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { logReadingDay, readingDays } from "@/server/reading";

/** The days you've read together (for the Home chart). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ days: [] });
  const days = await readingDays(session.user.id).catch(() => []);
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
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
