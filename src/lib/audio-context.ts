"use client";
// The app's single Web Audio context, shared by sound effects and the
// neural read-aloud voice. Once it has been resumed inside a real tap, it
// can play sounds at any later time - unlike <audio> elements and
// speechSynthesis, which iOS ties to user gestures.

let ctx: AudioContext | null = null;

function getCtor() {
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = getCtor();
    if (!Ctor) return null;
    ctx ??= new Ctor();
    // "suspended" (not yet unlocked / backgrounded) or Safari's
    // "interrupted" (another sound - e.g. the phone's own voice - took the
    // speaker): either way, ask for it back.
    if (ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Call synchronously inside a real tap/click handler (ideally the very first
 *  one on the page) to get the AudioContext running on iOS Safari, where it's
 *  otherwise created in a "suspended" state and its first sound can be lost
 *  while resume() is still pending. Safe to call repeatedly. */
export function unlockAudio() {
  const c = getAudioContext();
  if (!c) return;
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {}
}
