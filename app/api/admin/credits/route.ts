import { NextResponse } from "next/server";
import { currentAdmin, forgetAccount, accountOf } from "@/server/entitlements";
import { applyCredits, billingAvailable, creditBalance, creditLedger, getSubscription } from "@/server/billing";
import { getUser, setSuspended } from "@/server/users";

export const dynamic = "force-dynamic";

const none = () => new NextResponse(null, { status: 404 });

/** One account's paid state (admin only): its plan, balance, subscription
 *  and the newest lines of its ledger. */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return none();
  const userId = new URL(req.url).searchParams.get("user") ?? "";
  const profile = userId ? await getUser(userId, { fresh: true }).catch(() => null) : null;
  if (!profile) return NextResponse.json({ error: "No such account." }, { status: 404 });
  const account = await accountOf(userId).catch(() => null);
  return NextResponse.json(
    {
      user: { id: profile.id, username: profile.username, suspended: Boolean(profile.suspended) },
      tier: account?.tier ?? null,
      credits: await creditBalance(userId),
      subscription: await getSubscription(userId),
      ledger: await creditLedger(userId, 50),
      billingAvailable: billingAvailable(),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * Changes one account by hand (admin only) - for support, and for trying
 * credits out before there's anything to buy them with:
 *   { user, credits: +n | -n, note? }   give or take back credits
 *   { user, suspended: true | false }   bar the account from making, or lift it
 * A change to credits carries a reference of its own (`ref`, or one made
 * here), so sending the same request twice changes the balance once.
 */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return none();
  const body = (await req.json().catch(() => null)) as { user?: unknown; credits?: unknown; suspended?: unknown; note?: unknown; ref?: unknown } | null;
  const userId = typeof body?.user === "string" ? body.user : "";
  const profile = userId ? await getUser(userId, { fresh: true }).catch(() => null) : null;
  if (!profile) return NextResponse.json({ error: "No such account." }, { status: 404 });
  try {
    if (typeof body?.suspended === "boolean") {
      await setSuspended(userId, body.suspended);
      forgetAccount(userId);
    }
    let result = null;
    if (body?.credits !== undefined) {
      const delta = Number(body.credits);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) return NextResponse.json({ error: "Credits must be a whole number, not zero." }, { status: 400 });
      const ref = typeof body.ref === "string" && /^[\w.:-]{1,80}$/.test(body.ref) ? `admin:${body.ref}` : `admin:${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const note = `${typeof body.note === "string" ? body.note.slice(0, 120) : delta > 0 ? "Given" : "Taken back"} (by ${admin.username ?? "the admin"})`;
      result = await applyCredits(userId, delta, delta > 0 ? "grant" : "adjust", ref, note);
      if (!result.ok) return NextResponse.json({ error: result.reason === "insufficient" ? "They don't have that many credits." : "Credits can't be kept here yet: connect Redis first.", credits: result.balance }, { status: result.reason === "insufficient" ? 409 : 503 });
    }
    return NextResponse.json({ ok: true, applied: result?.applied ?? null, credits: await creditBalance(userId), suspended: typeof body?.suspended === "boolean" ? body.suspended : Boolean(profile.suspended) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "That couldn't be done." }, { status: 400 });
  }
}
