import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { storyteller, switchStoryteller } from "@/server/storyteller";
import { isStorytellerMode, modeOf } from "@/lib/storyteller";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

/** Who writes the stories (admin only): read, or switched. */
export async function GET() {
  if (!(await currentAdmin())) return new NextResponse(null, { status: 404 });
  const s = await storyteller();
  return NextResponse.json({ ...s, mode: modeOf(s) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!(await currentAdmin())) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => null)) as { mode?: unknown } | null;
  if (!isStorytellerMode(body?.mode)) return NextResponse.json({ error: "Not a storyteller setting." }, { status: 400 });
  try {
    await switchStoryteller(body.mode);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
  const s = await storyteller();
  return NextResponse.json({ ...s, mode: modeOf(s) }, { headers: NO_STORE });
}
