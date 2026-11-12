import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { currentAccount, currentAdmin } from "@/server/entitlements";
import { getSubscription, planOf } from "@/server/billing";
import { changePlan, openSubscriptionCheckout, portalLink, subscriptionsOpen } from "@/server/stripe";
import { isPaidPlan, PLANS } from "@/lib/tiers";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "private, no-store" };

/**
 * POST { plan: "plus" | "pro" }: moves the account to that plan.
 *   - From Basic: answers with Stripe Checkout's address ({ url }).
 *   - From another paid plan: Plus to Pro at once (Stripe charges for the
 *     rest of the month), Pro to Plus at the month's end ({ change }).
 *   Either way the plan here changes only when Stripe's notice arrives.
 * POST { portal: true }: the address of Stripe's customer portal - cards,
 *   invoices and cancelling ({ url }).
 * While subscriptions aren't switched on, says so ({ pending }).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const account = await currentAccount().catch(() => null);
  if (!account) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (account.isAdmin) return NextResponse.json({ error: "The admin account doesn't take a plan." }, { status: 400, headers: noStore });
  const body = (await req.json().catch(() => null)) as { plan?: unknown; portal?: unknown } | null;
  if (!subscriptionsOpen()) {
    return NextResponse.json({ pending: true, message: "Plans can't be bought just yet - card payments for them are still being set up. Nothing has been charged." }, { status: 503, headers: noStore });
  }
  const origin = new URL(req.url).origin;
  const sub = await getSubscription(account.id);
  try {
    if (body?.portal === true) {
      if (!sub?.customerId) return NextResponse.json({ error: "There's no subscription to manage yet." }, { status: 404, headers: noStore });
      return NextResponse.json({ url: await portalLink(sub.customerId, origin) }, { headers: noStore });
    }
    const plan = body?.plan;
    if (!isPaidPlan(plan)) return NextResponse.json({ error: "Choose Plus or Pro." }, { status: 400, headers: noStore });
    const live = sub && sub.status !== "canceled" && planOf(sub) && sub.subscriptionId;
    if (!live) {
      const url = await openSubscriptionCheckout({ userId: account.id, email: session.user.email, plan, origin, customerId: sub?.customerId ?? null });
      return NextResponse.json({ url }, { headers: noStore });
    }
    // (a renewal that hasn't been paid: the card is put right first)
    if (sub.status === "past_due") return NextResponse.json({ url: await portalLink(sub.customerId!, origin), message: "The last payment didn't go through - please update the card first." }, { headers: noStore });
    const change = await changePlan(sub, plan);
    const name = PLANS[plan].name;
    const message =
      change === "now"
        ? `Moving to ${name} now. It takes a moment to come through.`
        : change === "later"
          ? `You'll move to ${name} when this month's ${PLANS[sub.plan].name} ends${sub.periodEnd ? `, on ${new Date(sub.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}.`
          : `You'll stay on ${name}.`;
    return NextResponse.json({ change, message }, { headers: noStore });
  } catch (e) {
    console.error("[subscription] couldn't change the plan", e);
    const why = e as { type?: string; code?: string; message?: string };
    const admin = Boolean(session.user.isAdmin && (await currentAdmin().catch(() => null)));
    const detail = admin ? ` (Stripe said: ${[why.type, why.code].filter(Boolean).join(", ")}${why.message ? ` - ${why.message.slice(0, 200)}` : ""})` : "";
    return NextResponse.json({ error: `That couldn't be done just now. Nothing has been charged. Please try again.${detail}` }, { status: 502, headers: noStore });
  }
}
