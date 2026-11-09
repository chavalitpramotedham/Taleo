"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";

/** "Home" in the menu: your own home page when signed in (your stories and
 *  progress), the welcome page otherwise. */
export function NavHome() {
  const { status } = useSession();
  return (
    <Link href={status === "authenticated" ? "/home" : "/"} className="nav-link">
      Home
    </Link>
  );
}
