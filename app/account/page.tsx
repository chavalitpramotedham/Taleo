import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AccountForm } from "./AccountForm";
import { getUser, privateProfilesAvailable } from "@/server/users";
import { currentAccount } from "@/server/entitlements";
import { billingAvailable, creditBalance } from "@/server/billing";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?next=/account");
  if (!session.user.username) redirect("/welcome?next=/account");
  // (the plan and credits as the server's records have them now - the
  // cookie's copy of the plan only stands in if they can't be read. All
  // three are asked for together.)
  const [profile, account, balance] = await Promise.all([
    getUser(session.user.id).catch(() => null),
    currentAccount().catch(() => null),
    billingAvailable() ? creditBalance(session.user.id).catch(() => null) : Promise.resolve(null),
  ]);
  const credits = account ? balance : null;

  return (
    <div className="container wizard">
      <header className="wizard-head">
        <p className="eyebrow">Signed in as {session.user.email}</p>
        <h1>Manage account</h1>
      </header>
      <AccountForm
        username={session.user.username}
        avatarKey={session.user.avatarKey || "star"}
        isAdmin={account ? account.isAdmin : session.user.isAdmin}
        tier={account ? account.tier : session.user.tier}
        credits={credits}
        visibility={profile?.visibility ?? "public"}
        canGoPrivate={privateProfilesAvailable()}
      />
    </div>
  );
}
