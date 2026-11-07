"use client";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AccountNav() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (!session?.user) {
    return (
      <Link href="/sign-in" className="nav-link">
        Sign in
      </Link>
    );
  }

  return (
    <span className="account-nav">
      <span className="nav-link account-name">{session.user.username ? `@${session.user.username}` : session.user.name}</span>
      <button type="button" className="nav-link account-signout" onClick={() => signOut({ callbackUrl: "/" })}>
        Sign out
      </button>
    </span>
  );
}
