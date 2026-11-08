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

  // While sign-in status is still being checked, hold the button's exact
  // place (same size and shape) so the menu never shifts when it resolves.
  if (status === "loading") {
    return (
      <span className="icon-btn account-trigger account-trigger-pending" aria-hidden>
        <AccountIcon />
      </span>
    );
  }

  if (!session?.user) {
    return (
      <Link href="/sign-in" className="icon-btn account-trigger" aria-label="Sign in">
        <AccountIcon />
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
          <Link href="/my-stories" className="account-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            My bookshelf
          </Link>
          <Link href="/my-characters" className="account-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            My characters
          </Link>
          <Link href="/account" className="account-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            Manage account
          </Link>
          {session.user.isAdmin && (
            <Link href="/admin" className="account-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
              Dashboard
            </Link>
          )}
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
