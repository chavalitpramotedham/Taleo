"use client";
// Looping background music for the story reader, played from the audio
// files in /public/music through a single shared <audio> element.

export interface MusicTrack {
  id: string;
  name: string;
  src: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "rainbow-connection", name: "Rainbow Connection", src: "/music/rainbow-connection.m4a" },
  { id: "remember-me", name: "Remember Me", src: "/music/remember-me.m4a" },
  { id: "i-see-the-light", name: "I See the Light", src: "/music/i-see-the-light.m4a" },
  { id: "you-are-my-sunshine", name: "You Are My Sunshine", src: "/music/you-are-my-sunshine.m4a" },
];

export const defaultTrack = MUSIC_TRACKS[0];

export const trackById = (id: string): MusicTrack => MUSIC_TRACKS.find((t) => t.id === id) ?? defaultTrack;

const VOLUME = 0.35;

let el: HTMLAudioElement | null = null;
let wanted = false;
let retryArmed = false;

// ---- staying alive through other sounds ----
// Opening the microphone for dictation, or speaking a word / reading aloud,
// can make the browser (iOS especially) pause other media and never resume
// it. The music only ever stops when the reader stops it, so any other
// pause is treated as an interruption: a watchdog keeps trying to resume
// it - but holds off while the mic is open or speech is playing, so it
// never fights those for the speaker (which could cut dictation short).
const holds = new Set<string>();
let watchdog: number | null = null;

function stopWatchdog() {
  if (watchdog != null) window.clearInterval(watchdog);
  watchdog = null;
}

function ensurePlaying() {
  const p = el;
  if (!wanted || !p) return stopWatchdog();
  if (!p.paused) return stopWatchdog();
  if (holds.size) return; // try again on the next tick
  p.play().catch(armRetry);
}

function startWatchdog() {
  if (watchdog != null || typeof window === "undefined") return;
  watchdog = window.setInterval(ensurePlaying, 800);
}

/** Pause-proofing hold: while held (e.g. the mic is open), the music isn't
 *  forced back on (with `pause`, it's actively paused for the duration);
 *  releasing resumes it straight away if it was playing before. */
export function holdMusic(reason: string, on: boolean, opts: { pause?: boolean } = {}) {
  if (on) {
    holds.add(reason);
    // e.g. the mic: on phones, music playing can stop it from starting.
    if (opts.pause && el && !el.paused) el.pause();
  } else {
    holds.delete(reason);
    if (wanted && el?.paused) {
      startWatchdog();
      ensurePlaying();
    }
  }
}

// ---- softening under the voice ----
const ducks = new Set<string>();
const DUCKED = 0.1;
let fade: number | undefined;

/** Softens the music (smoothly) while something else - the read-aloud
 *  voice - needs to be heard, and brings it back up afterwards. (iOS
 *  ignores <audio> volume, so there it simply plays on underneath.) */
export function duckMusic(reason: string, on: boolean) {
  if (on) ducks.add(reason);
  else ducks.delete(reason);
  const p = el;
  if (!p) return;
  const target = ducks.size ? DUCKED : VOLUME;
  window.clearInterval(fade);
  fade = window.setInterval(() => {
    const next = p.volume + Math.sign(target - p.volume) * 0.03;
    if (Math.abs(target - p.volume) <= 0.03) {
      p.volume = target;
      window.clearInterval(fade);
    } else p.volume = Math.min(1, Math.max(0, next));
  }, 25);
}

/** Nudge: some other sound just finished, resume now if it was interrupted. */
export function resumeMusic() {
  if (wanted && el?.paused) {
    startWatchdog();
    ensurePlaying();
  }
}

function player(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio();
    el.loop = true;
    // Don't download the whole track up front (it would compete with the
    // story and its pictures on a phone connection) - it streams on play.
    el.preload = "none";
    el.volume = ducks.size ? DUCKED : VOLUME;
    el.addEventListener("pause", () => wanted && startWatchdog());
    el.addEventListener("playing", stopWatchdog);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && resumeMusic());
  }
  return el;
}

/** Browsers (iOS Safari especially) refuse play() outside a user gesture.
 *  If that happens, start on the very next tap anywhere instead. */
function armRetry() {
  if (retryArmed) return;
  retryArmed = true;
  const retry = () => {
    retryArmed = false;
    window.removeEventListener("pointerdown", retry);
    window.removeEventListener("keydown", retry);
    // Not while the mic is open: grabbing the speaker could end dictation.
    if (wanted && !holds.has("mic")) void player()?.play().catch(() => {});
  };
  window.addEventListener("pointerdown", retry, { once: true });
  window.addEventListener("keydown", retry, { once: true });
}

function tryPlay() {
  const p = player();
  if (!p) return;
  p.play().catch(armRetry);
}

/** Starts (or switches to) a looping track. */
export function playMusic(track: MusicTrack) {
  const p = player();
  if (!p) return;
  wanted = true;
  const url = new URL(track.src, window.location.href).href;
  if (p.src !== url) {
    p.src = url;
    p.currentTime = 0;
  }
  tryPlay();
}

export function stopMusic() {
  wanted = false;
  stopWatchdog();
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
}

export function setMusicMuted(muted: boolean) {
  const p = player();
  if (!p) return;
  p.muted = muted;
  // Unmuting is itself a tap, so it's a good moment to recover from a
  // blocked autoplay.
  if (!muted && wanted && p.paused) tryPlay();
}
