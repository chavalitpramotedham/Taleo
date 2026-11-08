"use client";
import { useEffect } from "react";

/** Sends unexpected errors in the app (in people's browsers) to the server,
 *  which emails the dev inbox. A few per page at most; noise from browser
 *  extensions and lost connections is skipped. */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const send = (message: string, stack?: string) => {
      if (sent >= 3 || !message) return;
      if (/ResizeObserver loop|Script error\.?$|Load failed|Failed to fetch|NetworkError|AbortError|aborted|chrome-extension|moz-extension/i.test(`${message} ${stack ?? ""}`)) return;
      sent++;
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, stack, page: location.pathname }),
        keepalive: true,
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => send(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : String(r ?? ""), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
