"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const EVENT = "taleo:toast";

/** Shows a short message at the foot of the screen, from anywhere: it fades
 *  in, stays a moment, then fades away. (One shown at a time.) */
export function useToast() {
  return useCallback((message: string) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
  }, []);
}

/** The one place toasts appear (mounted once, in the layout). */
export function ToastHost() {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      setLeaving(false);
      setMsg((m) => ({ text: (e as CustomEvent<string>).detail, n: (m?.n ?? 0) + 1 }));
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
    <div key={msg.n} className={`toast toast-global ${leaving ? "leaving" : ""}`} role="status" aria-live="polite">
      {msg.text}
    </div>,
    document.body,
  );
}
