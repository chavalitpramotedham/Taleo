import Stripe from "stripe";
import { applyCredits, creditBalance, getSubscription, planOf, setSubscription, type Subscription, type SubscriptionStatus } from "./billing";
import { setSuspended } from "./users";
import { forgetAccount } from "./entitlements";
import { CREDIT_PACK_MAX, CREDIT_PACK_MIN, isPaidPlan, packPrice, type PaidPlan } from "@/lib/tiers";

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

/** Stripe's tax category for what's sold: "Artificial Intelligence as a
 *  Service - Cloud Based - Personal Use" (AI tools hosted on the
 *  provider's servers, used in a browser, by individuals). */
const STRIPE_TAX_CODE = "txcd_10105001";

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
            // (what it is, for tax: Stripe works out the tax from this -
            // and Managed Payments won't sell a product without one)
            tax_code: STRIPE_TAX_CODE,
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
  // (a checkout opened during the short while credits were sold in
  // Singapore dollars, at 65 cents each, and paid after)
  const sgdWhile = s.currency === "sgd" && Number.isInteger(credits) && (s.amount_total ?? 0) >= Math.round((credits * 65 * (100 - (price?.off ?? 0))) / 100);
  if (!price || (!sgdWhile && (s.currency !== price.currency.toLowerCase() || (s.amount_total ?? 0) < Math.round(price.amount * 100)))) {
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

// ------------------------------------------------------------ subscriptions
//
// Plus and Pro are monthly subscriptions, also on Stripe:
//
//  - Upgrading from Basic opens Stripe Checkout in subscription mode: the
//    card is kept on file and charged each month from that day.
//  - The plan changes only when Stripe's signed webhook says so - never on
//    the browser's word that it came back from paying. Each notice reads
//    the subscription back from Stripe and records it as it is then, so a
//    notice sent twice, or late, or out of order changes nothing wrong.
//  - Plus to Pro is at once, with Stripe's charge for the rest of the
//    month; Pro to Plus waits for the end of the month paid for (a
//    subscription schedule). Cancelling, cards and invoices are in
//    Stripe's customer portal.
//
// Switched on only when the key and both price ids are set
// (STRIPE_PRICE_PLUS, STRIPE_PRICE_PRO: monthly prices made in Stripe's
// dashboard, on products with a tax category).

const priceFor = (plan: PaidPlan) => (plan === "plus" ? process.env.STRIPE_PRICE_PLUS : process.env.STRIPE_PRICE_PRO) || "";
export const subscriptionsOpen = () => paymentsOpen() && Boolean(process.env.STRIPE_PRICE_PLUS && process.env.STRIPE_PRICE_PRO);
/** Which plan a Stripe price is (null: not one of ours). */
const planOfPrice = (priceId: string | null | undefined): PaidPlan | null => (priceId && priceId === process.env.STRIPE_PRICE_PLUS ? "plus" : priceId && priceId === process.env.STRIPE_PRICE_PRO ? "pro" : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/** Opens Stripe Checkout for a new subscription to `plan`. Where to send
 *  the buyer. */
export async function openSubscriptionCheckout(opts: { userId: string; email?: string | null; plan: PaidPlan; origin: string; customerId?: string | null }): Promise<string> {
  const { userId, plan, origin } = opts;
  const price = priceFor(plan);
  if (!price) throw new Error("Subscriptions aren't switched on.");
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: userId,
    // (a returning subscriber keeps their Stripe customer - and its cards)
    ...(opts.customerId ? { customer: opts.customerId } : { customer_email: opts.email || undefined }),
    metadata: { userId, plan },
    // (the subscription itself carries whose it is: every later notice
    // about it is matched to the account by this)
    subscription_data: { metadata: { userId, plan } },
    success_url: `${origin}/account/plans?subscribed=${plan}`,
    cancel_url: `${origin}/account/plans`,
  });
  if (!session.url) throw new Error("Stripe didn't give a checkout page.");
  return session.url;
}

/** Stripe's customer portal for this customer: cards, invoices,
 *  cancelling. Where to send them. */
export async function portalLink(customerId: string, origin: string): Promise<string> {
  const portal = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/account/plans` });
  return portal.url;
}

const statusOf = (s: Stripe.Subscription.Status): SubscriptionStatus | null =>
  s === "active" || s === "trialing" ? "active" : s === "past_due" ? "past_due" : s === "canceled" || s === "unpaid" || s === "incomplete_expired" || s === "paused" ? "canceled" : null;

/**
 * Reads a subscription back from Stripe and records it on its account, as
 * it is now. `at`: when the notice was sent (an older one than the last
 * recorded changes nothing). Returns what was recorded (null: nothing -
 * not ours, not yet paid, or about an old subscription).
 */
export async function syncSubscription(subscriptionId: string, at: number): Promise<{ userId: string; sub: Subscription | null } | null> {
  if (!/^sub_[A-Za-z0-9_]{6,200}$/.test(subscriptionId)) return null;
  const sub = await stripe().subscriptions.retrieve(subscriptionId, { expand: ["schedule"] });
  const userId = sub.metadata?.userId;
  if (!userId) return null;
  const item = sub.items.data[0];
  const plan = planOfPrice(item?.price?.id);
  const status = statusOf(sub.status);
  // (not yet paid for - the first payment hasn't gone through: nothing
  // changes until it has)
  if (!plan || !status) return null;
  const current = await getSubscription(userId);
  // (a notice about an older subscription while a newer one is in force
  // is history: it doesn't replace it)
  if (current?.subscriptionId && current.subscriptionId !== sub.id && planOf(current) && status === "canceled") return null;
  // (a second subscription while one is already in force - two checkouts
  // opened side by side and both paid: the second is ended at once and its
  // payment refunded, so nobody pays twice)
  if (current?.subscriptionId && current.subscriptionId !== sub.id && current.status !== "canceled" && planOf(current) && status !== "canceled") {
    await refundDuplicate(sub);
    return null;
  }
  // (a move down waiting for the month's end: the schedule's next phase)
  const schedule = sub.schedule && typeof sub.schedule === "object" ? sub.schedule : null;
  const later = schedule?.phases?.find((p) => p.start_date * 1000 > Date.now());
  const nextPlan = later ? planOfPrice(idOf(later.items?.[0]?.price as string | { id: string })) : null;
  const ended = status === "canceled";
  const record: Omit<Subscription, "updatedAt"> = {
    plan,
    status,
    // (ended: when it did - at the period's end if cancelled then, at once
    // if payments ran out)
    periodEnd: ended ? (sub.ended_at ?? sub.canceled_at ?? Math.floor(Date.now() / 1000)) * 1000 : (item.current_period_end ?? 0) * 1000,
    periodStart: (item.current_period_start ?? 0) * 1000,
    provider: "stripe",
    customerId: idOf(sub.customer) ?? undefined,
    subscriptionId: sub.id,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    nextPlan: nextPlan && nextPlan !== plan ? nextPlan : null,
  };
  await setSubscription(userId, record, at);
  forgetAccount(userId);
  return { userId, sub: { ...record, updatedAt: at } };
}

/** Ends a subscription that doubled one already in force, and refunds
 *  what it was charged. */
async function refundDuplicate(sub: Stripe.Subscription): Promise<void> {
  const s = stripe();
  console.error("[stripe] a second subscription for one account: ending it and refunding", sub.id);
  await s.subscriptions.cancel(sub.id);
  const invoiceId = idOf(sub.latest_invoice as string | { id: string } | null);
  if (!invoiceId) return;
  const payments = await s.invoicePayments.list({ invoice: invoiceId, limit: 5 });
  for (const p of payments.data) {
    const pi = idOf((p.payment as { payment_intent?: string | { id: string } } | null)?.payment_intent ?? null);
    if (pi && p.status === "paid") await s.refunds.create({ payment_intent: pi, reason: "duplicate" }, { idempotencyKey: `dup-refund-${pi}` });
  }
}

/** Moves a live subscription to another paid plan: up at once (Stripe
 *  charges for the rest of the month now), down at the end of the month
 *  paid for. The plan recorded here changes when Stripe's notice of it
 *  arrives. */
export async function changePlan(current: Subscription, to: PaidPlan): Promise<"now" | "later" | "same"> {
  if (!current.subscriptionId || !isPaidPlan(current.plan)) throw new Error("No subscription to change.");
  const s = stripe();
  const sub = await s.subscriptions.retrieve(current.subscriptionId);
  const item = sub.items.data[0];
  const from = planOfPrice(item?.price?.id);
  const scheduleId = idOf(sub.schedule as string | { id: string } | null);
  if (from === to) {
    // (back to the plan it's on: a move down that was waiting is called off,
    // and so is a cancellation)
    if (scheduleId) await s.subscriptionSchedules.release(scheduleId);
    if (sub.cancel_at_period_end) await s.subscriptions.update(sub.id, { cancel_at_period_end: false });
    return "same";
  }
  if (to === "pro") {
    if (scheduleId) await s.subscriptionSchedules.release(scheduleId);
    // (only if the charge for the rest of the month goes through)
    await s.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: priceFor("pro") }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      ...(sub.cancel_at_period_end ? { cancel_at_period_end: false } : {}),
    });
    return "now";
  }
  // Down to Plus: Pro until the month paid for ends, then Plus.
  if (sub.cancel_at_period_end) await s.subscriptions.update(sub.id, { cancel_at_period_end: false });
  const schedule = scheduleId ? await s.subscriptionSchedules.retrieve(scheduleId) : await s.subscriptionSchedules.create({ from_subscription: sub.id });
  const now = schedule.phases[0];
  await s.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      { items: [{ price: priceFor("pro"), quantity: 1 }], start_date: now.start_date, end_date: item.current_period_end, metadata: sub.metadata },
      { items: [{ price: priceFor("plus"), quantity: 1 }], metadata: sub.metadata },
    ],
  });
  return "later";
}

/** What a Stripe notice is about, for the subscriptions: the subscription
 *  to read back (null: not about one). */
export function subscriptionOfEvent(event: Stripe.Event): string | null {
  const o = event.data.object as unknown as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return o.mode === "subscription" ? idOf(o.subscription as string | { id: string } | null) : null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return idOf(o as { id: string });
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const parent = o.parent as { subscription_details?: { subscription?: string | { id: string } } } | null;
      return idOf(parent?.subscription_details?.subscription ?? (o.subscription as string | null) ?? null);
    }
    case "subscription_schedule.created":
    case "subscription_schedule.updated":
    case "subscription_schedule.released":
    case "subscription_schedule.canceled":
    case "subscription_schedule.completed":
      return idOf(o.subscription as string | { id: string } | null);
    default:
      return null;
  }
}

/** Ends a subscription at once, with no refund for the rest of the month
 *  (the account is being deleted). Nothing to do if it has already ended. */
export async function cancelSubscriptionNow(subscriptionId: string): Promise<void> {
  if (!/^sub_[A-Za-z0-9_]{6,200}$/.test(subscriptionId)) return;
  const s = stripe();
  const sub = await s.subscriptions.retrieve(subscriptionId);
  if (sub.status === "canceled" || sub.status === "incomplete_expired") return;
  const scheduleId = idOf(sub.schedule as string | { id: string } | null);
  if (scheduleId) await s.subscriptionSchedules.release(scheduleId).catch(() => {});
  await s.subscriptions.cancel(subscriptionId);
}

/**
 * A payment that was refunded, or disputed with the card's bank: what was
 * bought with it is taken back.
 *  - Credits: as many of them as are still unspent come off the balance
 *    (once only, whatever Stripe sends).
 *  - A plan: a dispute ends the subscription at once.
 *  - A dispute also suspends the account, so credits bought, spent and
 *    then disputed can't be repeated; the admin can lift it.
 * Returns what was done, for the log.
 */
export async function takeBack(chargeId: string, how: "refund" | "dispute", refundedCents?: number): Promise<string> {
  const s = stripe();
  const charge = await s.charges.retrieve(chargeId);
  const piId = idOf(charge.payment_intent as string | { id: string } | null);
  const pi = piId ? await s.paymentIntents.retrieve(piId) : null;
  let userId = pi?.metadata?.userId || null;
  const credits = Number(pi?.metadata?.credits);
  const done: string[] = [];
  if (userId && Number.isInteger(credits) && credits > 0) {
    // (a refund of part of it takes back that part of the credits)
    const share = how === "refund" && refundedCents !== undefined && charge.amount > 0 ? Math.min(1, refundedCents / charge.amount) : 1;
    const back = Math.round(credits * share);
    const balance = (await creditBalance(userId)) ?? 0;
    const take = Math.min(back, balance);
    if (take > 0) {
      const r = await applyCredits(userId, -take, "adjust", `${how}:${chargeId}`.slice(0, 120), how === "dispute" ? "Payment disputed: credits taken back" : "Payment refunded: credits taken back");
      done.push(r.ok && r.applied ? `took back ${take} credits` : "credits already taken back");
    }
    if (take < back) done.push(`${back - take} were already spent`);
  } else if (charge.customer) {
    // (a plan's payment: whose subscription it was)
    const subs = await s.subscriptions.list({ customer: idOf(charge.customer as string | { id: string })!, status: "all", limit: 5 });
    const mine = subs.data.find((x) => x.metadata?.userId);
    userId = mine?.metadata?.userId ?? null;
    if (mine && how === "dispute" && mine.status !== "canceled") {
      await s.subscriptions.cancel(mine.id);
      done.push("ended the subscription");
    }
  }
  if (userId && how === "dispute") {
    await setSuspended(userId, true).catch(() => {});
    forgetAccount(userId);
    done.push("suspended the account");
  }
  return `${userId ?? "no account"}: ${done.join(", ") || "nothing to take back"}`;
}
