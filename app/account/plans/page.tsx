import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AccountPlans } from "../AccountTier";
import { Allowance } from "../Allowance";
import { currentAccount } from "@/server/entitlements";
import { rightsOf } from "@/server/rights";

/** Manage account > Account tier > Manage: every plan, side by side. */
export default async function PlansPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?next=/account/plans");
  // (what's left, and the plan itself, as the server's records have them)
  const account = await currentAccount().catch(() => null);
  const rights = account ? await rightsOf(account).catch(() => null) : null;
  return (
    <div className="container wizard">
      <header className="wizard-head">
        <p className="eyebrow">
          <Link href="/account">Manage account</Link>
        </p>
        <h1>Plans</h1>
      </header>
      {rights && <Allowance rights={rights} />}
      <AccountPlans isAdmin={account ? account.isAdmin : session.user.isAdmin} tier={account ? account.tier : session.user.tier} />
    </div>
  );
}
