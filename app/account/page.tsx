import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?next=/account");
  if (!session.user.username) redirect("/welcome?next=/account");

  return (
    <div className="container wizard">
      <header className="wizard-head">
        <p className="eyebrow">Signed in as {session.user.email}</p>
        <h1>Manage account</h1>
      </header>
      <AccountForm username={session.user.username} avatarKey={session.user.avatarKey || "star"} isAdmin={session.user.isAdmin} />
    </div>
  );
}
