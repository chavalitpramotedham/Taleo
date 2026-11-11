import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AccountPlans } from "../AccountTier";
import { PlansView } from "../Allowance";
import { currentAccount } from "@/server/entitlements";
import { rightsOf } from "@/server/rights";
import { creditLedger } from "@/server/billing";
import { transactionsOf } from "@/lib/transactions";

/** Manage account > Account tier > Manage: every plan, side by side. */
export default async function PlansPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?next=/account/plans");
  // (what's left, and the plan itself, as the server's records have them)
  const account = await currentAccount().catch(() => null);
  // (what's left, and what its credits were spent on and when more
  // arrived: asked for together)
  const [rights, ledger] = account ? await Promise.all([rightsOf(account).catch(() => null), creditLedger(account.id, 200).catch(() => [])]) : [null, []];
  const history = rights ? transactionsOf(ledger) : [];
  return (
    <div className="container wizard">
      <header className="wizard-head">
        <p className="eyebrow">
          <Link href="/account">Manage account</Link>
        </p>
        <h1>Plan and credits</h1>
      </header>
      {rights ? (
        <PlansView rights={rights} history={history}>
          <AccountPlans isAdmin={rights.isAdmin} tier={rights.tier} />
        </PlansView>
      ) : (
        <AccountPlans isAdmin={session.user.isAdmin} tier={session.user.tier} />
      )}
    </div>
  );
}
