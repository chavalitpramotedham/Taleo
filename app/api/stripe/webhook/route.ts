import { NextResponse } from "next/server";
import { fulfil, webhookEvent } from "@/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe's word that a payment went through (registered in Stripe's
 * dashboard: Developers > Webhooks, for checkout.session.completed and
 * checkout.session.async_payment_succeeded). Anything not signed with
 * STRIPE_WEBHOOK_SECRET is turned away. The credits are added once,
 * however many times Stripe sends it.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const event = webhookEvent(body, req.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Not signed by Stripe." }, { status: 400 });
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      const done = await fulfil((event.data.object as { id: string }).id);
      console.log("[stripe] payment", event.type, done.status, done.credits);
    } catch (e) {
      // (an error answer makes Stripe try again later)
      console.error("[stripe] couldn't add the credits", e);
      return NextResponse.json({ error: "Try again." }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
