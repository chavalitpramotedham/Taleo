"use client";
import { useEffect, useState } from "react";
import { INSTALL_EVENT, type InstallWay, handheld, installOffer, installWay, runningAsApp } from "@/lib/install";
import { MapleMark, ShareIcon } from "./Icons";
import { useToast } from "./Toast";

/** Wakes the service worker (the live site only: in development it would
 *  hold on to files that change under it). After the page has loaded, so
 *  it never competes with the first paint. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const start = () => void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    if (document.readyState === "complete") start();
    else {
      window.addEventListener("load", start, { once: true });
      return () => window.removeEventListener("load", start);
    }
  }, []);
  return null;
}

/** Whether "Add shortcut" has anything to offer: not once Taleo is
 *  already open from its own icon. */
export const canAddShortcut = () => !runningAsApp();

const STEPS: Record<Exclude<InstallWay, "none">, React.ReactNode[]> = {
  ios: [
    <>
      Tap <b>Share</b>
      <span className="shortcut-glyph" aria-hidden>
        <ShareIcon />
      </span>
      in your browser&apos;s toolbar.
    </>,
    <>
      Scroll down and tap <b>Add to Home Screen</b>.
    </>,
    <>
      Tap <b>Add</b>. Taleo appears among your apps.
    </>,
  ],
  "ios-inapp": [
    <>
      Open the <b>•••</b> menu and choose <b>Open in Safari</b> (or <b>Open in browser</b>).
    </>,
    <>
      In Safari, tap <b>Share</b>
      <span className="shortcut-glyph" aria-hidden>
        <ShareIcon />
      </span>
      then <b>Add to Home Screen</b>.
    </>,
    <>
      Tap <b>Add</b>. Taleo appears among your apps.
    </>,
  ],
  "mac-safari": [
    <>
      In Safari&apos;s menu bar, open <b>File</b>.
    </>,
    <>
      Choose <b>Add to Dock</b>.
    </>,
    <>
      Click <b>Add</b>. Taleo appears in your Dock.
    </>,
  ],
  android: [
    <>
      Open your browser&apos;s menu <b>⋮</b>.
    </>,
    <>
      Tap <b>Add to Home screen</b> (some browsers say <b>Install app</b>).
    </>,
    <>
      Tap <b>Add</b>. Taleo appears among your apps.
    </>,
  ],
  desktop: [
    <>
      Open your browser&apos;s menu <b>⋮</b>.
    </>,
    <>
      Choose <b>Cast, save and share</b>, then <b>Install page as app</b> (in Edge: <b>Apps</b>, then <b>Install this site as an app</b>).
    </>,
    <>
      Click <b>Install</b>. Taleo opens in its own window from now on.
    </>,
  ],
};

/**
 * "Add shortcut": Taleo on the home screen, opening full screen from its
 * own icon. Where the browser lets us offer it directly (Chrome, Edge,
 * Android) one button does it; elsewhere (iPhone, iPad, Safari on a Mac)
 * the three taps are shown, since only the parent can make them.
 */
export function AddShortcutDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [offer, setOffer] = useState(installOffer);
  const [way] = useState(installWay);
  const [busy, setBusy] = useState(false);
  const phone = handheld(way);

  useEffect(() => {
    const look = () => setOffer(installOffer());
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener(INSTALL_EVENT, look);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener(INSTALL_EVENT, look);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const add = async () => {
    if (!offer || busy) return;
    setBusy(true);
    try {
      await offer.prompt();
      const { outcome } = await offer.userChoice;
      // (an offer can be put to the parent only once)
      window.__taleoInstall = null;
      if (outcome === "accepted") {
        toast(phone ? "Taleo is on your home screen" : "Taleo is added");
        return onClose();
      }
      setOffer(null);
    } catch {
      setOffer(null);
    } finally {
      setBusy(false);
    }
  };

  const where = phone ? "home screen" : way === "mac-safari" ? "Dock" : "computer";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel draft-prompt shortcut-prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add a shortcut to Taleo">
        <div className="modal-head">
          <h3>Add a shortcut</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <img className="shortcut-icon" src="/icon-192.png" alt="" width={72} height={72} />
        <p className="draft-title">Taleo on your {where}</p>
        <p className="meta">{phone ? "One tap on its icon" : "One click on its icon"} opens Taleo {phone ? "full screen" : "in its own window"}, like an app. Nothing to download, and it takes no room.</p>
        {offer ? (
          <div className="story-preview-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={add} disabled={busy}>
              <MapleMark />
              Add to {where}
            </button>
            <button type="button" className="btn btn-soft btn-block" onClick={onClose}>
              Not now
            </button>
          </div>
        ) : way === "none" ? (
          <>
            <p className="meta shortcut-cant">This browser can&apos;t add shortcuts. Open taleo-stories.app in Chrome, Edge or Safari and choose Add shortcut there, or bookmark this page to keep it close.</p>
            <div className="story-preview-actions">
              <button type="button" className="btn btn-soft btn-block" onClick={onClose}>
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="shortcut-steps">
              {STEPS[way].map((s, i) => (
                <li key={i}>
                  <span className="shortcut-n" aria-hidden>
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="story-preview-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
                <MapleMark />
                Got it
              </button>
            </div>
            {way === "desktop" && <p className="meta starts-left">Already added it? Taleo is with your other apps.</p>}
          </>
        )}
      </div>
    </div>
  );
}
