import { NextResponse } from "next/server";
import { fulfil, subscriptionOfEvent, syncSubscription, webhookEvent } from "@/server/stripe";
import { noticeSeen } from "@/server/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe's word that something was paid for (registered in Stripe's
 * dashboard: Developers > Webhooks). Anything not signed with
 * STRIPE_WEBHOOK_SECRET is turned away.
 *
 *  - Credit packs: checkout.session.completed and
 *    checkout.session.async_payment_succeeded. The credits are added once,
 *    however many times Stripe sends it.
 *  - Plans: checkout.session.completed, customer.subscription.created /
 *    updated / deleted, invoice.paid, invoice.payment_failed and
 *    subscription_schedule.updated / released. Each reads the subscription
 *    back from Stripe and records it as it is now.
 *
 * Each notice is dealt with once: sent again, it's recognised and changes
 * nothing. (One that fails is answered with an error, so Stripe sends it
 * again later - and it's only noted as dealt with once it has been.)
 */
export async function POST(req: Request) {
  const body = await req.text();
  const event = webhookEvent(body, req.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Not signed by Stripe." }, { status: 400 });
  if (await noticeSeen(event.id).catch(() => false)) return NextResponse.json({ received: true, already: true });
  try {
    const subscription = subscriptionOfEvent(event);
    if (subscription) {
      const done = await syncSubscription(subscription, event.created * 1000);
      console.log("[stripe] subscription", event.type, done ? `${done.sub?.plan} ${done.sub?.status}` : "unchanged");
    } else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const done = await fulfil((event.data.object as { id: string }).id);
      console.log("[stripe] payment", event.type, done.status, done.credits);
    }
  } catch (e) {
    // (an error answer makes Stripe try again later)
    console.error("[stripe] couldn't deal with a notice", event.type, e);
    return NextResponse.json({ error: "Try again." }, { status: 500 });
  }
  await noticeSeen(event.id, true).catch(() => false);
  return NextResponse.json({ received: true });
}
