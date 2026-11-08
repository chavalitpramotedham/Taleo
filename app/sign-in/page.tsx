import { redirect } from "next/navigation";
import { auth, signIn } from "@/server/auth";
import { Ornament } from "@/components/Icons";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await auth();
  if (session?.user) redirect(session.user.username ? next || "/" : "/welcome");

  return (
    <div className="container empty">
      <p className="eyebrow">Join parents like you</p>
      <h1>Sign in to begin</h1>
      <p className="meta">We use your Google account to know which stories are yours, so you can be credited and see who enjoyed them.</p>
      <Ornament className="ornament center" />
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: next ? `/welcome?next=${encodeURIComponent(next)}` : "/welcome" });
        }}
      >
        <button type="submit" className="btn btn-primary">
          Continue with Google
        </button>
      </form>
    </div>
  );
}
