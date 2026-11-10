/**
 * Putting Taleo on the home screen (or the Dock, or the desktop).
 *
 * Chrome, Edge and Android browsers hand the page an "install" offer it
 * can show at a moment of its choosing: the layout's first script catches
 * it the instant it arrives (see app/layout.tsx) and keeps it on
 * `window.__taleoInstall`. Safari has no such offer - there the parent
 * adds it by hand, and we show them how.
 */

export interface InstallOffer extends Event {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __taleoInstall?: InstallOffer | null;
  }
}

/** Tells listeners the offer arrived, was used, or the app was added. */
export const INSTALL_EVENT = "taleo:install";

/** The inline script that catches the browser's offer before React wakes. */
export const INSTALL_CATCH = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__taleoInstall=e;dispatchEvent(new Event("${INSTALL_EVENT}"))});addEventListener("appinstalled",function(){window.__taleoInstall=null;dispatchEvent(new Event("${INSTALL_EVENT}"))});`;

export const installOffer = (): InstallOffer | null => (typeof window === "undefined" ? null : (window.__taleoInstall ?? null));

/** Already opened from its own icon: nothing left to add. */
export function runningAsApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || ["standalone", "fullscreen", "minimal-ui"].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
}

export type InstallWay =
  /** iPhone / iPad: Share, then "Add to Home Screen". */
  | "ios"
  /** iPhone / iPad inside another app's built-in browser: open in Safari first. */
  | "ios-inapp"
  /** Safari on a Mac: File, then "Add to Dock". */
  | "mac-safari"
  /** An Android browser that made no offer: its own menu has the entry. */
  | "android"
  /** Chrome / Edge on a computer with no offer (often: already added). */
  | "desktop"
  /** A browser that can't do it at all (Firefox on a computer). */
  | "none";

/** How this browser adds a site to the home screen, when it makes no offer. */
export function installWay(): InstallWay {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat/i.test(ua) ? "ios-inapp" : "ios";
  if (/Android/.test(ua)) return "android";
  const chromium = /Chrome|Chromium|Edg\//.test(ua);
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !chromium) return "mac-safari";
  if (chromium) return "desktop";
  return "none";
}

/** A phone or tablet (it has a "home screen"); otherwise a computer. */
export const handheld = (way: InstallWay) => way === "ios" || way === "ios-inapp" || way === "android";
