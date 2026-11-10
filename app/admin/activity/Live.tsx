"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** A moment, written in the clock of whoever is looking (the server only
 *  knows UTC, which is what's shown until the page wakes). */
export function When({ at, full = false }: { at: number; full?: boolean }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(at);
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(full ? { year: "numeric" } : {}) });
    setLocal(full || !today ? `${day}, ${time}` : time);
  }, [at, full]);
  return (
    <time dateTime={new Date(at).toISOString()} title={new Date(at).toISOString()} suppressHydrationWarning>
      {local ?? `${new Date(at).toISOString().slice(5, 19).replace("T", " ")} UTC`}
    </time>
  );
}

/** Keeps the page current while it's being watched: asks the server for
 *  it again every ten seconds (only while the tab is in view), and at once
 *  on coming back to the tab. On unless switched off; switching it off is
 *  remembered on this device. */
const OFF_KEY = "taleo.admin.live-off";
export function AutoRefresh() {
  const router = useRouter();
  const [on, setOn] = useState(true);
  const [last, setLast] = useState<number | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem(OFF_KEY) === "1") setOn(false);
    } catch {}
  }, []);
  const turn = (next: boolean) => {
    setOn(next);
    try {
      if (next) localStorage.removeItem(OFF_KEY);
      else localStorage.setItem(OFF_KEY, "1");
    } catch {}
  };
  useEffect(() => {
    if (!on) return;
    const again = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLast(Date.now());
    };
    const id = window.setInterval(again, 10_000);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", again);
    };
  }, [on, router]);
  return (
    <p className="meta admin-live">
      <label>
        <input type="checkbox" checked={on} onChange={(e) => turn(e.target.checked)} /> Keep this page up to date (every 10 seconds)
      </label>
      {on && last && (
        <>
          {" · updated "}
          <When at={last} />
        </>
      )}
    </p>
  );
}

/** A filter that's on or off (as a link, so it's in the address), shown
 *  as a pill that turns at once when tapped - the list follows when the
 *  server has it - and stays where you are on the page. */
export function ToggleChip({ on, href, children }: { on: boolean; href: string; children: React.ReactNode }) {
  const [shown, setShown] = useState(on);
  // (the page arrived, or changed from elsewhere: follow it)
  const [seen, setSeen] = useState(on);
  if (seen !== on) {
    setSeen(on);
    setShown(on);
  }
  return (
    <Link
      href={href}
      scroll={false}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        setShown(!shown);
      }}
      className={`chip${shown ? " on" : ""}`}
      aria-pressed={shown}
    >
      {children}
    </Link>
  );
}
