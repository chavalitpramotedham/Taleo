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

function player(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.volume = VOLUME;
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
    if (wanted) void player()?.play().catch(() => {});
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
