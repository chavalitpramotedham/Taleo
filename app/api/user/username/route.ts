import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { setUsername, UsernameTakenError } from "@/server/users";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (typeof body.username !== "string") return NextResponse.json({ error: "Missing username." }, { status: 400 });

  try {
    const profile = await setUsername(session.user.id, body.username);
    return NextResponse.json({ profile });
  } catch (e) {
    const status = e instanceof UsernameTakenError ? 409 : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't set that username." }, { status });
  }
}
