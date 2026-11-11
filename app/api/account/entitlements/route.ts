import { NextResponse } from "next/server";
import { currentAccount } from "@/server/entitlements";
import { rightsOf } from "@/server/rights";

export const dynamic = "force-dynamic";

/** What the signed-in account can do right now, from the server's own
 *  records: stories and characters left on its plan, its credits and what
 *  they buy (see server/rights). For the account menu and the details
 *  page - the server checks again when anything is actually made. */
export async function GET() {
  try {
    const account = await currentAccount();
    if (!account) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    return NextResponse.json(await rightsOf(account), { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    console.error("[entitlements]", e);
    return NextResponse.json({ error: "Couldn't read your account just now. Please try again." }, { status: 503 });
  }
}
