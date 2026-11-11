import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { applyCredits, creditBalance } from "@/server/billing";
import { MAX_CREDITS_ADDED } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/**
 * Adds credits to the account that asks - and only ever to that account:
 * there is no "for whom" in the request, the credits go to whoever is
 * signed in. Only the admin's test account may (by the records, not the
 * cookie); to anyone else this address doesn't exist. A whole number, 1
 * to MAX_CREDITS_ADDED at a time.
 */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => null)) as { amount?: unknown } | null;
  // (digits only: "20", never "2e1", "-5" or "20 ")
  const text = typeof body?.amount === "number" ? String(body.amount) : typeof body?.amount === "string" ? body.amount : "";
  const amount = /^[0-9]{1,6}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_CREDITS_ADDED) {
    return NextResponse.json({ error: `Enter a whole number from 1 to ${MAX_CREDITS_ADDED.toLocaleString("en-GB")}.` }, { status: 400 });
  }
  const added = await applyCredits(admin.id, amount, "grant", `self:${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`, "Added by hand (the test account)");
  if (!added.ok) return NextResponse.json({ error: "Credits can't be kept here yet: connect Redis first." }, { status: 503 });
  return NextResponse.json({ ok: true, added: amount, credits: (await creditBalance(admin.id)) ?? added.balance }, { headers: { "cache-control": "private, no-store" } });
}
