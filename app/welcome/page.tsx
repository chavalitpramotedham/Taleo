import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { WelcomeForm } from "./WelcomeForm";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const { next } = await searchParams;
  if (session.user.username) redirect(next || "/home");

  return (
    <div className="container wizard">
      <header className="wizard-head">
        <p className="eyebrow">Welcome to Taleo</p>
        <h1>What shall we call you?</h1>
        <p className="sub">Your username goes on the stories you make together, as their author. You can change it any time in Account.</p>
      </header>
      <WelcomeForm suggested={(session.user.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20)} next={next}/>
    </div>
  );
}
