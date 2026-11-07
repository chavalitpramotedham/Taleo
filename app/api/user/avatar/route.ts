import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { setAvatar } from "@/server/users";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { avatarKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (typeof body.avatarKey !== "string") return NextResponse.json({ error: "Missing avatarKey." }, { status: 400 });

  try {
    const profile = await setAvatar(session.user.id, body.avatarKey);
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save that avatar." }, { status: 400 });
  }
}
