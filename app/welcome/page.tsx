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
        <p className="eyebrow">One last thing</p>
        <h1>Choose a username</h1>
        <p className="sub">This is how you&apos;ll be credited on stories you write, and shown to anyone who rates them.</p>
      </header>
      <WelcomeForm suggested={(session.user.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20)} next={next}/>
    </div>
  );
}
