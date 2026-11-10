"use client";
import { useEffect, useState } from "react";
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
 *  it again every ten seconds (only while the tab is in view). */
export function AutoRefresh() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [last, setLast] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLast(Date.now());
    }, 10_000);
    return () => window.clearInterval(id);
  }, [on, router]);
  return (
    <p className="meta admin-live">
      <label>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Keep this page up to date (every 10 seconds)
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
