import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AccountPlans } from "../AccountTier";

/** Manage account > Account tier > Manage: every plan, side by side. */
export default async function PlansPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?next=/account/plans");
  return (
    <div className="container wizard">
      <header className="wizard-head">
        <p className="eyebrow">
          <Link href="/account">Manage account</Link>
        </p>
        <h1>Plans</h1>
      </header>
      <AccountPlans isAdmin={session.user.isAdmin} />
    </div>
  );
}
