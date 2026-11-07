"use client";
import { useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const MAX_PULL = 110;

/** A touch-drag-down-from-the-top-of-the-page gesture reloads the app, the
 *  way native pull-to-refresh does — needed because installed/standalone
 *  PWAs (see manifest.ts) generally lose the browser's own version of it. */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      if (window.scrollY > 0) {
        startY.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      const next = dy > 0 ? Math.min(dy * 0.5, MAX_PULL) : 0;
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  if (pull === 0 && !refreshing) return null;

  return (
    <div className="pull-refresh" style={{ height: refreshing ? THRESHOLD : pull }} aria-hidden>
      <span className={`pull-refresh-spin ${refreshing || pull >= THRESHOLD ? "ready" : ""}`} />
    </div>
  );
}
