import { WelcomeForm } from "../../welcome/WelcomeForm";
import { AccountPlans } from "../../account/AccountTier";

/** Dev only: sign-up's "18 or over" box, and the plans with their
 *  renewal terms under each Upgrade button - without signing in. */
export default function LegalDevPage() {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <div className="container wizard">
      <WelcomeForm suggested="devparent" />
      <AccountPlans isAdmin={false} tier="free" open />
    </div>
  );
}
