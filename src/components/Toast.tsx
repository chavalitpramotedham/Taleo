"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const EVENT = "taleo:toast";

/** Shows a short message floating at the top of the screen, from anywhere -
 *  a small glassy pill with a tick (done) or a cross (removed / failed): it
 *  drops in, stays a moment, then fades away. (One shown at a time.) */
export type ToastKind = "done" | "removed" | "error";

export function useToast() {
  return useCallback((message: string, kind: ToastKind = "done") => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { text: message, kind } }));
  }, []);
}

/** The one place toasts appear (mounted once, in the layout). */
export function ToastHost() {
  const [msg, setMsg] = useState<{ text: string; kind: ToastKind; n: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      setLeaving(false);
      const d = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail;
      setMsg((m) => ({ text: d.text, kind: d.kind, n: (m?.n ?? 0) + 1 }));
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const a = window.setTimeout(() => setLeaving(true), 2200);
    const b = window.setTimeout(() => setMsg(null), 2600);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [msg]);
  if (!msg) return null;
  return createPortal(
    <div key={msg.n} className={`glass-toast ${msg.kind} ${leaving ? "leaving" : ""}`} role="status" aria-live="polite">
      <span className="glass-toast-icon" aria-hidden>
        {msg.kind === "done" ? (
          <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="11" height="11"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        )}
      </span>
      {msg.text}
    </div>,
    document.body,
  );
}
