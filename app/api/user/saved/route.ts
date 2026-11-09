import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { savedStories, setSaved } from "@/server/saved";

/** Your saved stories (ids, and the library entries still there). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const data = await savedStories(session.user.id);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** Save a library story to your bookshelf, or take it off: { id, saved }. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; saved?: unknown } | null;
  const id = typeof body?.id === "string" && /^[\w-]{1,80}$/.test(body.id) ? body.id : null;
  if (!id || typeof body?.saved !== "boolean") return NextResponse.json({ error: "Which story?" }, { status: 400 });
  const ids = await setSaved(session.user.id, id, body.saved);
  return NextResponse.json({ ids });
}
