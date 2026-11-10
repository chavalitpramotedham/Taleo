"use client";
// The app's single Web Audio context, shared by sound effects and the
// neural read-aloud voice. Once it has been resumed inside a real tap, it
// can play sounds at any later time - unlike <audio> elements and
// speechSynthesis, which iOS ties to user gestures.

let ctx: AudioContext | null = null;

function getCtor() {
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** On iPhone, a web page's Web Audio counts as "ambient" sound, which the
 *  ring/silent switch mutes - so in silent mode the read-aloud voice, the
 *  music and the tap sounds all went quiet. Ask for media playback instead
 *  (like a video or a music app), which plays whatever the switch says.
 *  Safari 17+ supports this directly; for older iPhones a silent, looping
 *  media element started inside the first tap switches the whole page into
 *  media playback too. */
function playThroughSilentSwitch() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {}
}
let keepAlive: HTMLAudioElement | null = null;
function startSilentMedia() {
  if (keepAlive || typeof document === "undefined") return;
  // (only needed where the audio session can't be set directly)
  if ((navigator as Navigator & { audioSession?: unknown }).audioSession) return;
  // ...and only on iPhone/iPad: the silent switch is theirs. Elsewhere a
  // looping media element is pointless, and Android can show it as
  // something playing (media controls in the notification shade).
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) return;
  try {
    keepAlive = document.createElement("audio");
    keepAlive.setAttribute("x-webkit-airplay", "deny");
    keepAlive.loop = true;
    keepAlive.preload = "auto";
    keepAlive.muted = false;
    keepAlive.volume = 0.01;
    // a quarter-second of silence
    keepAlive.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    void keepAlive.play().catch(() => {
      keepAlive = null;
    });
  } catch {
    keepAlive = null;
  }
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  playThroughSilentSwitch();
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
  playThroughSilentSwitch();
  startSilentMedia();
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

/** Call inside any tap: if the audio has gone quiet since (iPhone suspends
 *  or "interrupts" it - more readily in silent mode), bring it back while
 *  the tap still counts as permission. Cheap when it's already running. */
export function wakeAudio() {
  playThroughSilentSwitch();
  if (!ctx || ctx.state !== "running") unlockAudio();
}

/** While read-aloud is on, play an inaudible tone on a loop so the phone
 *  never parks the audio between pages - otherwise a page read on a timer
 *  (after the turn, not inside a tap) can't restart it, and in silent mode
 *  only the tapped words were heard. */
let holdSrc: AudioBufferSourceNode | null = null;
export function holdAudioOpen(on: boolean) {
  if (!on) {
    try {
      holdSrc?.stop();
    } catch {}
    holdSrc = null;
    return;
  }
  if (holdSrc) return;
  const c = getAudioContext();
  if (!c) return;
  try {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate); // 1s of silence
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g).connect(c.destination);
    src.start();
    holdSrc = src;
  } catch {
    holdSrc = null;
  }
}

/** Leaving the app (another app, the home screen, the phone locked): put
 *  every sound to sleep - nothing plays in the background. */
export function sleepAudio() {
  if (ctx && ctx.state === "running") void ctx.suspend().catch(() => {});
  keepAlive?.pause();
}
/** Back in the app: the silent keep-alive (older iPhones) picks up again;
 *  everything else wakes on its own or on the next tap. */
export function stirAudio() {
  if (keepAlive?.paused) void keepAlive.play().catch(() => {});
}
