"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";

/** A way home: your own home page when signed in, the welcome page
 *  otherwise (the same rule as the menu's "Home"). */
export function HomeLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { status } = useSession();
  return (
    <Link className={className} href={status === "authenticated" ? "/home" : "/"}>
      {children}
    </Link>
  );
}
