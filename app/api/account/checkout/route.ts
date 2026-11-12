import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { CREDIT_PACK_MAX, CREDIT_PACK_MIN } from "@/lib/tiers";
import { fulfil, openCheckout, paymentsOpen } from "@/server/stripe";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "private, no-store" };

/**
 * POST { credits }: opens a Stripe Checkout page for that many credits and
 * answers with where to go ({ url }). The price is worked out here, never
 * taken from the request. While payments aren't switched on (no Stripe
 * key), it says so ({ pending }) and nothing is charged.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { credits?: unknown } | null;
  const credits = typeof body?.credits === "number" ? body.credits : NaN;
  if (!Number.isInteger(credits) || credits < CREDIT_PACK_MIN || credits > CREDIT_PACK_MAX) {
    return NextResponse.json({ error: `Choose a whole number of credits, from ${CREDIT_PACK_MIN} to ${CREDIT_PACK_MAX}.` }, { status: 400 });
  }
  if (!paymentsOpen()) {
    return NextResponse.json(
      { pending: true, credits, message: "Card payments are still being set up. Nothing has been charged, and no credits have been added." },
      { status: 503, headers: noStore },
    );
  }
  try {
    const url = await openCheckout({ userId: session.user.id, email: session.user.email, credits, origin: new URL(req.url).origin });
    return NextResponse.json({ url }, { headers: noStore });
  } catch (e) {
    console.error("[checkout] couldn't open", e);
    return NextResponse.json({ error: "The checkout couldn't be opened just now. Nothing has been charged. Please try again." }, { status: 502, headers: noStore });
  }
}

/**
 * GET ?session=cs_...: back from Stripe - has that payment come through?
 * If it has, its credits are added now (if the webhook hasn't already:
 * either way they're added once). Only for the account that paid.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("session") || "";
  if (!paymentsOpen() || !/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) return NextResponse.json({ error: "Not a payment." }, { status: 400 });
  try {
    const done = await fulfil(id);
    if (done.userId !== session.user.id) return NextResponse.json({ error: "Not a payment." }, { status: 404, headers: noStore });
    return NextResponse.json({ status: done.status, credits: done.credits, balance: done.balance ?? null }, { headers: noStore });
  } catch (e) {
    console.error("[checkout] couldn't confirm", e);
    return NextResponse.json({ error: "We couldn't confirm the payment just now." }, { status: 502, headers: noStore });
  }
}
