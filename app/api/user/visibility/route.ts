import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { setVisibility } from "@/server/users";

/** Make your stories public (found in the library and on your bookshelf
 *  page) or private. Private isn't offered yet: it's refused until it's
 *  switched on (see privateProfilesAvailable). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { visibility?: unknown } | null;
  const v = body?.visibility;
  if (v !== "public" && v !== "private") return NextResponse.json({ error: "Choose public or private." }, { status: 400 });
  try {
    const profile = await setVisibility(session.user.id, v);
    return NextResponse.json({ visibility: profile.visibility ?? "public" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save that." }, { status: 403 });
  }
}
