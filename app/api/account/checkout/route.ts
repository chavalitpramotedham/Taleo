import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { CREDIT_PACK_MAX, CREDIT_PACK_MIN, packPrice } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/**
 * Buying credits: where the card checkout will begin.
 *
 * NOT OPEN YET. This is the place kept for it: the request is checked (a
 * signed-in account, a whole number of credits), and then - instead of
 * opening a Stripe Checkout page - it answers that payments aren't
 * switched on. Nothing is charged and no credits are added, ever, by
 * this route as it stands.
 *
 * When payments are built, this is where the Stripe Checkout Session is
 * created (for `credits` at `packPrice(credits)`, with the account's id
 * and a reference of its own in the session's metadata) and its `url`
 * sent back for the page to go to. The credits themselves are added only
 * when Stripe's own notice of the payment arrives (a webhook, checked by
 * its signature) - never because a browser came back saying it paid.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { credits?: unknown } | null;
  const credits = typeof body?.credits === "number" ? body.credits : NaN;
  if (!Number.isInteger(credits) || credits < CREDIT_PACK_MIN || credits > CREDIT_PACK_MAX) {
    return NextResponse.json({ error: `Choose a whole number of credits, from ${CREDIT_PACK_MIN} to ${CREDIT_PACK_MAX}.` }, { status: 400 });
  }
  // (worked out here, never taken from the request: the browser says how
  // many credits, the server says what they cost)
  const price = packPrice(credits);
  return NextResponse.json(
    {
      pending: true,
      credits,
      price,
      message: "Card payments are still being set up. Nothing has been charged, and no credits have been added.",
    },
    { status: 503, headers: { "cache-control": "private, no-store" } },
  );
}
