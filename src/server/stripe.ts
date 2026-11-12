import Stripe from "stripe";
import { applyCredits } from "./billing";
import { CREDIT_PACK_MAX, CREDIT_PACK_MIN, packPrice } from "@/lib/tiers";

/**
 * Card payments for credits, with Stripe Checkout (Stripe's own hosted
 * payment page).
 *
 * Switched on only when STRIPE_SECRET_KEY is set (in the hosting's
 * environment variables - never in the code). Without it, buying credits
 * says plainly that payments aren't open, and nothing can be charged.
 *
 * How a purchase goes:
 *  1. The page asks for so many credits; the server works out the price
 *     itself (lib/tiers: packPrice - never from the browser) and opens a
 *     Checkout Session for exactly that, labelled with the account.
 *  2. The buyer pays on Stripe's page. Taleo never sees the card.
 *  3. Stripe tells Taleo the payment went through - by a signed webhook
 *     (STRIPE_WEBHOOK_SECRET), and again when the buyer comes back to
 *     the site. Either way `fulfil` reads the session back from Stripe,
 *     checks it was paid and paid in full, and adds the credits - once
 *     only, under the session's own reference, however many times it's
 *     told (the ledger refuses a reference it has seen).
 */

let client: Stripe | null = null;
export const paymentsOpen = () => Boolean(process.env.STRIPE_SECRET_KEY);
function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payments aren't switched on.");
  // (over the standard fetch, as Vercel's servers - and any proxy the host sets - expect)
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: "Taleo" }, httpClient: Stripe.createFetchHttpClient() });
  return client;
}

/** Opens a Stripe Checkout page for `credits` credits, for this account.
 *  Returns where to send the buyer. */
export async function openCheckout(opts: { userId: string; email?: string | null; credits: number; origin: string }): Promise<string> {
  const { userId, credits, origin } = opts;
  if (!Number.isInteger(credits) || credits < CREDIT_PACK_MIN || credits > CREDIT_PACK_MAX) throw new Error("Not a number of credits that can be bought.");
  const price = packPrice(credits)!;
  const cents = Math.round(price.amount * 100);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: price.currency.toLowerCase(),
          unit_amount: cents,
          product_data: {
            name: `${credits.toLocaleString("en-US")} Taleo credits`,
            description: price.off ? `${price.off}% off - credits for making bedtime stories and characters` : "Credits for making bedtime stories and characters",
          },
        },
      },
    ],
    client_reference_id: userId,
    customer_email: opts.email || undefined,
    // (what to add, and to whom - read back when the payment is confirmed)
    metadata: { userId, credits: String(credits), cents: String(cents) },
    payment_intent_data: { metadata: { userId, credits: String(credits) } },
    success_url: `${origin}/account/plans?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account/plans?tab=credits`,
  });
  if (!session.url) throw new Error("Stripe didn't give a checkout page.");
  return session.url;
}

export type Fulfilled = { status: "added" | "already" | "unpaid" | "mismatch"; credits: number; userId: string | null; balance?: number };

/** Adds the credits a Checkout Session paid for - if it was paid, in full,
 *  and only once. Safe to call any number of times, from anywhere. */
export async function fulfil(sessionId: string): Promise<Fulfilled> {
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) throw new Error("Not a checkout session.");
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  const userId = s.metadata?.userId || s.client_reference_id || null;
  const credits = Number(s.metadata?.credits);
  if (s.payment_status !== "paid" || !userId) return { status: "unpaid", credits: 0, userId };
  // (paid what that many credits cost, in that currency - nothing less)
  const price = Number.isInteger(credits) ? packPrice(credits) : null;
  if (!price || s.currency !== price.currency.toLowerCase() || (s.amount_total ?? 0) < Math.round(price.amount * 100)) {
    console.error("[stripe] a paid session didn't match its credits", sessionId);
    return { status: "mismatch", credits: 0, userId };
  }
  const added = await applyCredits(userId, credits, "purchase", `stripe:${s.id}`.slice(0, 120), `Bought ${credits} credits by card`);
  if (!added.ok) throw new Error("The credits couldn't be added just now.");
  return { status: added.applied ? "added" : "already", credits, userId, balance: added.balance };
}

/** Checks a webhook really came from Stripe; the event, or null. */
export function webhookEvent(body: string, signature: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;
  try {
    return stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return null;
  }
}
