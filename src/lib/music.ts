"use client";
import { getAudioContext } from "./audio-context";
// Looping background music for the story reader, played from the audio
// files in /public/music through a single shared <audio> element - routed
// through the app's Web Audio context where possible, so its volume can be
// eased up and down smoothly on every device (iOS ignores <audio> volume).

export interface MusicTrack {
  id: string;
  name: string;
  src: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "rainbow-connection", name: "Rainbow Connection", src: "/music/rainbow-connection.m4a" },
  { id: "pure-imagination", name: "Pure Imagination", src: "/music/pure-imagination.m4a" },
  { id: "remember-me", name: "Remember Me", src: "/music/remember-me.m4a" },
  { id: "i-see-the-light", name: "I See the Light", src: "/music/i-see-the-light.m4a" },
  { id: "you-are-my-sunshine", name: "You Are My Sunshine", src: "/music/you-are-my-sunshine.m4a" },
];

export const defaultTrack = MUSIC_TRACKS[0];

export const trackById = (id: string): MusicTrack => MUSIC_TRACKS.find((t) => t.id === id) ?? defaultTrack;

const VOLUME = 0.23; // quietly in the background: the voice is the focus

let el: HTMLAudioElement | null = null;
let wanted = false;
/** Muted = paused (not just silenced): nothing keeps playing, and nothing
 *  tries to bring it back until it's unmuted. */
let mutedByUser = false;
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

/** Is the music actually audible? Not if the element is paused - and,
 *  when it plays through Web Audio, not if that context was suspended or
 *  "interrupted" (iOS does this when the phone's own voice speaks), even
 *  though the element itself still reports playing. */
function silenced(p: HTMLAudioElement) {
  return p.paused || (gain !== null && gain.context.state !== "running");
}

function ensurePlaying() {
  const p = el;
  if (!wanted || mutedByUser || !p) return stopWatchdog();
  if (!silenced(p)) return stopWatchdog();
  if (holds.size) return; // try again on the next tick
  if (gain) getAudioContext(); // asks a suspended/interrupted context to resume
  if (p.paused) p.play().catch(armRetry);
  else if (gain && gain.context.state !== "running") {
    // still not back: try again on the next tap, which iOS always allows
    armRetry();
  }
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
    if (wanted && el && silenced(el)) {
      startWatchdog();
      ensurePlaying();
    }
  }
}

// ---- softening under the voice ----
// A gentle dip, not a cut: the music eases down to about a third of its volume
// over roughly a second while the voice speaks, and drifts back up a
// little more slowly afterwards.
const ducks = new Set<string>();
const DUCKED = VOLUME * 0.5; // half the music under the voice (11.5% of full) - never silent
const DOWN_S = 0.32; // time constant easing down (~1s to settle)
const UP_S = 0.5; // ... and back up (~1.5s)
let gain: GainNode | null = null;
let fade = 0;

const level = () => (ducks.size ? DUCKED : VOLUME);

/** Eases the music's volume to where it should be now. */
function glide() {
  const target = level();
  const ctx = gain?.context;
  if (gain && ctx) {
    const now = ctx.currentTime;
    const g = gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(target, now, target < g.value ? DOWN_S : UP_S);
    return;
  }
  // Fallback (no Web Audio): ease the element's own volume frame by frame.
  const p = el;
  if (!p) return;
  cancelAnimationFrame(fade);
  let last = performance.now();
  const step = (t: number) => {
    const dt = (t - last) / 1000;
    last = t;
    const tau = target < p.volume ? DOWN_S : UP_S;
    const next = target + (p.volume - target) * Math.exp(-dt / tau);
    p.volume = Math.abs(next - target) < 0.004 ? target : Math.min(1, Math.max(0, next));
    if (p.volume !== target) fade = requestAnimationFrame(step);
  };
  fade = requestAnimationFrame(step);
}

/** Softens the music (smoothly) while something else - the read-aloud
 *  voice - needs to be heard, and brings it back up afterwards. */
export function duckMusic(reason: string, on: boolean) {
  if (on) ducks.add(reason);
  else ducks.delete(reason);
  glide();
}

/** Nudge: some other sound just finished, resume now if it was interrupted. */
export function resumeMusic() {
  if (wanted && el && silenced(el)) {
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
    // Through Web Audio when available, so the volume can glide on every
    // device; the element itself then stays at full volume.
    // On iPhone, Web Audio is silenced by the ring/silent switch while
    // media keeps playing; the music used to be plain media, so ask for
    // media-style playback to keep it audible (Safari 17+; ignored elsewhere).
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch {}
    const ctx = getAudioContext();
    if (ctx) {
      try {
        const src = ctx.createMediaElementSource(el);
        gain = ctx.createGain();
        gain.gain.value = level();
        src.connect(gain).connect(ctx.destination);
        el.volume = 1;
      } catch {
        gain = null;
      }
    }
    if (!gain) el.volume = level();
    el.addEventListener("pause", () => wanted && !mutedByUser && startWatchdog());
    if (gain) {
      gain.context.addEventListener("statechange", () => {
        if (wanted && gain && gain.context.state !== "running") startWatchdog();
      });
    }
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
    if (wanted && !mutedByUser && !holds.has("mic")) {
      if (gain) getAudioContext();
      void player()?.play().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", retry, { once: true });
  window.addEventListener("keydown", retry, { once: true });
}

function tryPlay() {
  const p = player();
  if (!p || mutedByUser) return;
  if (gain) getAudioContext(); // wakes a suspended context (it carries the music)
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

/** Muting pauses the music. Unmuting carries on: the same tune from where
 *  it stopped, or - if a different tune was picked while muted - the new
 *  one from its start (playMusic already loaded it, without playing). */
export function setMusicMuted(muted: boolean) {
  mutedByUser = muted;
  const p = player();
  if (!p) return;
  p.muted = false;
  if (muted) {
    stopWatchdog();
    p.pause();
  } else if (wanted) {
    // Unmuting is itself a tap, so it's also a good moment to recover
    // from a blocked autoplay.
    tryPlay();
  }
}
