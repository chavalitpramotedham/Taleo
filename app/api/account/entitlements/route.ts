import { NextResponse } from "next/server";
import { currentAccount } from "@/server/entitlements";
import { billingAvailable } from "@/server/billing";
import { CREDIT_PRICES } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/** What the signed-in account may do right now, from the server's own
 *  records: its plan, its on-demand credits and what they buy. (For the
 *  Account pages and anything that offers to spend a credit - the server
 *  checks again when it's actually spent.) */
export async function GET() {
  let account;
  try {
    account = await currentAccount();
  } catch {
    return NextResponse.json({ error: "Couldn't read your account just now. Please try again." }, { status: 503 });
  }
  if (!account) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const sub = account.subscription;
  return NextResponse.json(
    {
      tier: account.tier,
      plan: account.plan.name,
      suspended: account.suspended,
      credits: await account.credits(),
      creditsAvailable: billingAvailable(),
      prices: CREDIT_PRICES,
      // (nothing of the payment provider's is sent to the browser)
      subscription: sub ? { plan: sub.plan, status: sub.status, periodEnd: sub.periodEnd } : null,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
