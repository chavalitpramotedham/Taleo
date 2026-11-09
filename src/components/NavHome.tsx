"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/** The menu's page links - Home, Library, About - with the page you're
 *  on picked out (darker, heavier lettering). "Home" is your own home page
 *  when signed in, the welcome page otherwise. */
export function NavLinks() {
  const path = usePathname() || "/";
  const { status } = useSession();
  const home = status === "authenticated" ? "/home" : "/";
  const links = [
    { href: home, label: "Home", on: path === "/home" || path === "/" },
    // stories and bookshelves are part of the library
    { href: "/store", label: "Library", on: path.startsWith("/store") || path.startsWith("/author") },
    { href: "/about", label: "About", on: path.startsWith("/about") },
  ];
  return (
    <>
      {links.map((l) => (
        <Link key={l.label} href={l.href} className={`nav-link ${l.on ? "current" : ""}`} aria-current={l.on ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
