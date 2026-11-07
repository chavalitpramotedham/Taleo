"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { AccountIcon } from "./Icons";
import { Avatar } from "./Avatar";

export function AccountNav() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  if (status === "loading") return null;

  if (!session?.user) {
    return (
      <Link href="/sign-in" className="nav-link">
        Sign in
      </Link>
    );
  }

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="icon-btn account-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="My account">
        {session.user.avatarKey ? <Avatar avatarKey={session.user.avatarKey} /> : <AccountIcon />}
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <p className="account-dropdown-name">@{session.user.username}</p>
          <Link href="/account" className="account-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            Manage account
          </Link>
          <button
            type="button"
            className="account-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
