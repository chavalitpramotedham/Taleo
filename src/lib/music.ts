"use client";
// Gentle, looping bedtime-story background music, synthesised with the Web
// Audio API - same approach as sfx.ts, so no audio files are needed and it
// shares the same (already-unlocked) AudioContext.

import { audio } from "./sfx";

export interface MusicTrack {
  id: string;
  name: string;
  /** Theme/mood keywords this track suits best, used to pick a sensible default. */
  moods: string[];
  loopSeconds: number;
  /** Schedules one loop's worth of notes, starting at audio-clock time `t0`. */
  schedule: (c: AudioContext, dest: AudioNode, t0: number) => void;
}

/** A soft sine/triangle note with a slow attack and release - no plucky
 *  transient, just a gentle swell, like a held breath. */
function note(
  c: AudioContext,
  dest: AudioNode,
  t0: number,
  freq: number,
  dur: number,
  vol: number,
  { type = "sine", attack = 0.25, release }: { type?: OscillatorType; attack?: number; release?: number } = {},
) {
  const rel = release ?? Math.min(dur * 0.6, 1.2);
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0005, vol), t0 + attack);
  g.gain.setValueAtTime(Math.max(0.0005, vol), Math.max(t0 + attack, t0 + dur - rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** A soft, steady cushion underneath the melody: two slightly detuned sine
 *  oscillators for warmth. Deliberately no tremolo/LFO - a slow pulse on a
 *  sustained low tone is the classic horror-ambient trick, and a bedtime
 *  tune should never flirt with that. */
function pad(c: AudioContext, dest: AudioNode, t0: number, freq: number, dur: number, vol: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0005, vol), t0 + 1.2);
  g.gain.setValueAtTime(Math.max(0.0005, vol), t0 + dur - 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(dest);

  for (const detune of [-3, 3]) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

let noiseBuf: AudioBuffer | null = null;
/** A very soft, narrow, high-pitched shimmer - like a distant, gentle
 *  breeze - not a howl. Kept high and quiet so it reads as pleasant
 *  texture, never as something unsettling. */
function windNoise(c: AudioContext, dest: AudioNode, t0: number, dur: number, vol: number) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(1600, t0);
  bp.frequency.linearRampToValueAtTime(2000, t0 + dur / 2);
  bp.frequency.linearRampToValueAtTime(1600, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0005, vol), t0 + 2);
  g.gain.setValueAtTime(Math.max(0.0005, vol), t0 + dur - 2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(dest);
  src.start(t0, Math.random() * 10);
  src.stop(t0 + dur + 0.05);
}

// Note names as hertz, to keep this self-contained (no note-name parser).
// All five tracks are deliberately in a major key with a continuous,
// clearly singable melody - no long stretches of bare drone, no minor
// tonality, nothing in the "ambient horror" register. The pad underneath
// is always quieter than the melody, a cushion rather than the point.
const C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.0, A3 = 220.0;
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, Fs4 = 369.99, G4 = 392.0, A4 = 440.0, C5 = 523.25;

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "starlight",
    name: "Starlight Lullaby",
    moods: ["bedtime", "feelings", "default"],
    loopSeconds: 7.2,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, C3, 7.2, 0.03);
      pad(c, dest, t0, G3, 7.2, 0.02);
      [C4, E4, G4, A4, G4, E4].forEach((f, i) => note(c, dest, t0 + i * 1.2, f, 1.3, 0.07, { type: "triangle" }));
    },
  },
  {
    id: "hush",
    name: "Sleepy Hush",
    moods: ["feelings", "bedtime"],
    loopSeconds: 9,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, G3, 9, 0.025);
      pad(c, dest, t0, D4, 9, 0.018);
      [G4, A4, G4, E4, D4, E4].forEach((f, i) => note(c, dest, t0 + i * 1.5, f, 1.7, 0.055, { type: "sine" }));
    },
  },
  {
    id: "waves",
    name: "Gentle Waves",
    moods: ["adventure", "nature", "mission"],
    loopSeconds: 7.2,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, D3, 7.2, 0.03);
      pad(c, dest, t0, A3, 7.2, 0.02);
      [D4, E4, Fs4, A4, Fs4, E4].forEach((f, i) => note(c, dest, t0 + i * 1.2, f, 1.3, 0.065, { type: "triangle" }));
    },
  },
  {
    id: "meadow",
    name: "Meadow Breeze",
    moods: ["nature", "family", "sharing", "mystery"],
    loopSeconds: 7.2,
    schedule: (c, dest, t0) => {
      windNoise(c, dest, t0, 7.2, 0.02);
      pad(c, dest, t0, F3, 7.2, 0.025);
      pad(c, dest, t0, C4, 7.2, 0.018);
      [F4, G4, A4, C5, A4, G4].forEach((f, i) => note(c, dest, t0 + i * 1.2, f, 1.3, 0.06, { type: "triangle" }));
    },
  },
  {
    id: "waltz",
    name: "Dreamy Waltz",
    moods: ["party", "friends"],
    loopSeconds: 7.2,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, F3, 7.2, 0.03);
      pad(c, dest, t0, C4, 7.2, 0.02);
      [F4, A4, C5, A4, G4, F4].forEach((f, i) => note(c, dest, t0 + i * 1.2, f, 1.3, 0.065, { type: "triangle" }));
    },
  },
];

export const defaultTrack = MUSIC_TRACKS[0];

/** Picks the track whose moods best match the story's theme text (falling
 *  back to the "default"-tagged track), so the app's suggestion actually
 *  fits what the story is about. */
export function recommendTrack(theme: string): MusicTrack {
  const t = theme.toLowerCase();
  const scored = MUSIC_TRACKS.map((track) => ({ track, score: track.moods.filter((m) => m !== "default" && t.includes(m)).length }));
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) return scored[0].track;
  return MUSIC_TRACKS.find((m) => m.moods.includes("default")) ?? defaultTrack;
}

export const trackById = (id: string): MusicTrack => MUSIC_TRACKS.find((t) => t.id === id) ?? defaultTrack;

// ---------------------------------------------------------------- engine

let gainNode: GainNode | null = null;
let generation = 0;
let currentVolume = 0.4; // 0-1 "how loud when unmuted", independent of mute
let muted = false;

function ensureGain(c: AudioContext): GainNode {
  if (!gainNode) {
    gainNode = c.createGain();
    gainNode.gain.value = muted ? 0 : currentVolume;
    gainNode.connect(c.destination);
  }
  return gainNode;
}

function scheduleChain(track: MusicTrack, myGeneration: number) {
  const c = audio();
  if (!c || myGeneration !== generation) return;
  const dest = ensureGain(c);
  const t0 = c.currentTime + 0.05;
  track.schedule(c, dest, t0);
  window.setTimeout(
    () => {
      if (myGeneration === generation) scheduleChain(track, myGeneration);
    },
    Math.max(200, (track.loopSeconds - 1) * 1000),
  );
}

/** Starts (or switches to) a looping track. Safe to call repeatedly - each
 *  call invalidates any previously scheduled loop chain. */
export function playMusic(track: MusicTrack) {
  generation += 1;
  scheduleChain(track, generation);
}

export function stopMusic() {
  generation += 1;
  if (gainNode) {
    const c = audio();
    if (c) gainNode.gain.setTargetAtTime(0.0001, c.currentTime, 0.2);
  }
}

export function setMusicMuted(next: boolean) {
  muted = next;
  const c = audio();
  if (c && gainNode) gainNode.gain.setTargetAtTime(muted ? 0.0001 : currentVolume, c.currentTime, 0.2);
}
