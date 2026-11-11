import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { copyAccounts, moveStatus, retirePublicFiles } from "@/server/account-move";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const none = () => new NextResponse(null, { status: 404 });
const headers = { "cache-control": "private, no-store" };

/** Where the move of account records out of the public file store has got
 *  to (admin only - see server/account-move). */
export async function GET() {
  if (!(await currentAdmin())) return none();
  try {
    return NextResponse.json({ status: await moveStatus() }, { headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't check." }, { status: 500, headers });
  }
}

/**
 * The admin's two steps:
 *   { step: "copy" }                    bring everything across (repeatable)
 *   { step: "retire", confirm: true }   remove the old public files
 */
export async function POST(req: Request) {
  if (!(await currentAdmin())) return none();
  const body = (await req.json().catch(() => null)) as { step?: unknown; confirm?: unknown } | null;
  try {
    if (body?.step === "copy") return NextResponse.json({ copied: await copyAccounts(), status: await moveStatus() }, { headers });
    if (body?.step === "retire") {
      if (body.confirm !== true) return NextResponse.json({ error: "Removing the public files can't be undone: confirm it first." }, { status: 400, headers });
      return NextResponse.json({ retired: await retirePublicFiles(), status: await moveStatus() }, { headers });
    }
    return NextResponse.json({ error: "Not a step." }, { status: 400, headers });
  } catch (e) {
    console.error("[account-move]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "That couldn't be done." }, { status: 500, headers });
  }
}
