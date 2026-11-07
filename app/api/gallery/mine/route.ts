import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { listMyStories } from "@/server/gallery";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const stories = await listMyStories(session.user.id);
  return NextResponse.json({ stories });
}
