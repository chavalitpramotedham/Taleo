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

/** A sustained drone pad: two slightly detuned oscillators for warmth, with
 *  a slow tremolo so it breathes rather than sitting static. */
function pad(c: AudioContext, dest: AudioNode, t0: number, freq: number, dur: number, vol: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0005, vol), t0 + 1.4);
  g.gain.setValueAtTime(Math.max(0.0005, vol), t0 + dur - 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(dest);

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = vol * 0.25;
  lfo.connect(lfoGain).connect(g.gain);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.05);

  for (const detune of [-4, 4]) {
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
  bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(420, t0);
  bp.frequency.linearRampToValueAtTime(650, t0 + dur / 2);
  bp.frequency.linearRampToValueAtTime(420, t0 + dur);
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
const F2 = 87.31, A2 = 110.0, C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, Fs3 = 185.0, G3 = 196.0;
const A3 = 220.0, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.0, A4 = 440.0;

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "starlight",
    name: "Starlight Lullaby",
    moods: ["bedtime", "feelings", "default"],
    loopSeconds: 8,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, C3, 8, 0.05);
      pad(c, dest, t0, G3, 8, 0.035);
      [C4, E4, G4, A4, G4, E4].forEach((f, i) => note(c, dest, t0 + i * 1.3, f, 1.5, 0.045));
    },
  },
  {
    id: "moonlit",
    name: "Moonlit Hush",
    moods: ["mystery", "feelings", "bedtime"],
    loopSeconds: 10,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, A2, 10, 0.05);
      pad(c, dest, t0, E3, 10, 0.03);
      [A3, C4, E4, D4, C4].forEach((f, i) => note(c, dest, t0 + i * 1.9, f, 2.2, 0.04, { type: "triangle" }));
    },
  },
  {
    id: "waves",
    name: "Gentle Waves",
    moods: ["adventure", "nature", "mission"],
    loopSeconds: 10,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, D3, 10, 0.055);
      pad(c, dest, t0, Fs3, 10, 0.04);
      pad(c, dest, t0, A3, 10, 0.035);
      note(c, dest, t0 + 4.5, D4, 3, 0.03, { attack: 1.2 });
    },
  },
  {
    id: "meadow",
    name: "Meadow Breeze",
    moods: ["nature", "family", "sharing"],
    loopSeconds: 12,
    schedule: (c, dest, t0) => {
      windNoise(c, dest, t0, 12, 0.06);
      pad(c, dest, t0, C3, 12, 0.04);
      [E4, G4, A4].forEach((f, i) => note(c, dest, t0 + 3 + i * 3, f, 2, 0.028, { type: "triangle", attack: 0.8 }));
    },
  },
  {
    id: "waltz",
    name: "Dreamy Waltz",
    moods: ["party", "friends", "mission"],
    loopSeconds: 9,
    schedule: (c, dest, t0) => {
      pad(c, dest, t0, F2, 9, 0.05);
      pad(c, dest, t0, C3, 9, 0.03);
      [F3, A3, C4, F3, D4, A3, F3, A3, C4].forEach((f, i) => note(c, dest, t0 + i * 1, f, 1.1, 0.035, { type: "triangle" }));
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
let currentVolume = 0.5; // 0-1 "how loud when unmuted", independent of mute
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
