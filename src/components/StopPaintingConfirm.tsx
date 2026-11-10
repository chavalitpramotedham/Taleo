"use client";
import { useEffect } from "react";

/** While a character is being painted, closing the tab or reloading asks
 *  first (the browser's own "Leave site?" prompt). */
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

/** Leaving while a character is still being painted: ask first. Stopping
 *  throws the painting away; staying lets it finish. Shown over the popup
 *  that is doing the painting. */
export function StopPaintingConfirm({ name, onStop, onStay }: { name?: string; onStop: () => void; onStay: () => void }) {
  const who = name?.trim();
  return (
    <div className="modal-backdrop redraw-backdrop" onClick={(e) => (e.stopPropagation(), onStay())}>
      <div className="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-stop-painting" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-stop-painting">Stop painting{who ? ` ${who}` : ""}?</h3>
        <p className="confirm-warning">
          {who ? `${who}'s` : "Their"} picture is still being painted. If you stop now it&apos;s thrown away, and it still counts as one of your
          paintings.
        </p>
        <div className="redraw-choices">
          <button type="button" className="btn btn-danger btn-block" onClick={onStop}>
            Yes, stop painting
          </button>
          <button type="button" className="btn btn-soft btn-block" onClick={onStay}>
            Keep painting
          </button>
        </div>
      </div>
    </div>
  );
}
