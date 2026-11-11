"use client";

/** This browser's own id (the same in all its tabs, kept for good): only a
 *  way for the server to tell "this device" from "another one" when a
 *  story is being made - not a secret, and it says nothing about anyone. */
const KEY = "taleo.device";
export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[\w-]{8,64}$/.test(id)) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
/** The header that carries it (empty where storage isn't allowed). */
export const deviceHeader = (): Record<string, string> => {
  const id = deviceId();
  return id ? { "x-taleo-device": id } : {};
};

/** "Still making a story here": said now and every 40 seconds while the
 *  page is in view; and "I've left it" when the page goes away. Returns
 *  how to stop. */
export function holdStorySession(): () => void {
  const id = deviceId();
  if (!id) return () => {};
  const say = () => {
    if (document.visibilityState === "visible") void fetch("/api/story/session", { method: "POST", headers: deviceHeader(), keepalive: true }).catch(() => {});
  };
  say();
  const every = window.setInterval(say, 40_000);
  document.addEventListener("visibilitychange", say);
  const leave = () => void fetch(`/api/story/session?d=${encodeURIComponent(id)}`, { method: "DELETE", headers: deviceHeader(), keepalive: true }).catch(() => {});
  window.addEventListener("pagehide", leave);
  return () => {
    window.clearInterval(every);
    document.removeEventListener("visibilitychange", say);
    window.removeEventListener("pagehide", leave);
    leave();
  };
}
