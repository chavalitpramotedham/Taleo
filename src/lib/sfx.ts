"use client";
// Small, gentle cartoon sound effects synthesised with the Web Audio API, so
// no audio files are needed. Each page's tap-target names one of these.

import type { SoundId } from "./actions";

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const MASTER = 0.35;

function out(c: AudioContext, gain = 1) {
  const g = c.createGain();
  g.gain.value = MASTER * gain;
  g.connect(c.destination);
  return g;
}

/** An oscillator with a pitch path and an attack/decay envelope. */
function tone(
  c: AudioContext,
  dest: AudioNode,
  { type = "sine", freqs, at = 0, dur, vol = 1, attack = 0.01 }: { type?: OscillatorType; freqs: [number, number][]; at?: number; dur: number; vol?: number; attack?: number },
) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freqs[0][1], t0);
  for (const [t, f] of freqs.slice(1)) o.frequency.exponentialRampToValueAtTime(Math.max(20, f), t0 + t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
}

let noiseBuf: AudioBuffer | null = null;
/** Filtered white noise with an envelope. */
function noise(
  c: AudioContext,
  dest: AudioNode,
  { at = 0, dur, vol = 1, filter = "bandpass", f0, f1 = f0, q = 1, attack = 0.01 }: { at?: number; dur: number; vol?: number; filter?: BiquadFilterType; f0: number; f1?: number; q?: number; attack?: number },
) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bq = c.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t0);
  bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bq).connect(g).connect(dest);
  src.start(t0, Math.random());
  src.stop(t0 + dur + 0.05);
}

const PLAYERS: Record<SoundId, (c: AudioContext, o: AudioNode) => void> = {
  boing: (c, o) => {
    const osc = tone(c, o, { freqs: [[0, 160], [0.12, 520], [0.45, 300]], dur: 0.5, vol: 0.8 });
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 18;
    lg.gain.value = 40;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start();
    lfo.stop(c.currentTime + 0.55);
  },
  splash: (c, o) => {
    noise(c, o, { dur: 0.6, vol: 0.9, f0: 1800, f1: 500, q: 0.7 });
    [0.12, 0.2, 0.31, 0.42].forEach((at, i) => tone(c, o, { freqs: [[0, 900 + i * 260], [0.06, 1700 + i * 200]], at, dur: 0.08, vol: 0.25 }));
  },
  pop: (c, o) => {
    tone(c, o, { freqs: [[0, 720], [0.08, 160]], dur: 0.1, vol: 0.9, attack: 0.003 });
    noise(c, o, { dur: 0.05, vol: 0.4, f0: 3000, filter: "highpass", attack: 0.002 });
  },
  whoosh: (c, o) => noise(c, o, { dur: 0.7, vol: 0.9, f0: 300, f1: 2400, q: 1.6, attack: 0.25 }),
  twinkle: (c, o) =>
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(c, o, { freqs: [[0, f]], at: i * 0.08, dur: 0.5, vol: 0.35, type: "triangle" })),
  knock: (c, o) =>
    [0, 0.18].forEach((at) => {
      tone(c, o, { freqs: [[0, 180], [0.08, 90]], at, dur: 0.12, vol: 0.9, attack: 0.002 });
      noise(c, o, { at, dur: 0.06, vol: 0.5, f0: 900, q: 2, attack: 0.002 });
    }),
  munch: (c, o) => [0, 0.16, 0.32].forEach((at) => noise(c, o, { at, dur: 0.1, vol: 0.8, f0: 1400, f1: 700, q: 1.2, attack: 0.004 })),
  buzz: (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.connect(o);
    const osc = tone(c, lp, { type: "sawtooth", freqs: [[0, 190], [0.4, 230], [0.8, 180]], dur: 0.85, vol: 0.4, attack: 0.05 });
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 24;
    lg.gain.value = 18;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start();
    lfo.stop(c.currentTime + 0.9);
  },
  tweet: (c, o) =>
    [0, 0.16, 0.3].forEach((at, i) => tone(c, o, { freqs: [[0, 2200 + i * 150], [0.08, 3600], [0.12, 2800]], at, dur: 0.13, vol: 0.35 })),
  roar: (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(o);
    tone(c, lp, { type: "sawtooth", freqs: [[0, 110], [0.25, 150], [0.8, 80]], dur: 0.85, vol: 0.6, attack: 0.08 });
    noise(c, o, { dur: 0.8, vol: 0.35, f0: 500, f1: 300, q: 0.8, attack: 0.1 });
  },
  ding: (c, o) => {
    tone(c, o, { freqs: [[0, 1320]], dur: 1.2, vol: 0.5, attack: 0.003 });
    tone(c, o, { freqs: [[0, 2640]], dur: 0.6, vol: 0.15, attack: 0.003 });
  },
  thud: (c, o) => {
    tone(c, o, { freqs: [[0, 120], [0.2, 45]], dur: 0.28, vol: 1, attack: 0.003 });
    noise(c, o, { dur: 0.12, vol: 0.4, f0: 300, filter: "lowpass", attack: 0.003 });
  },
  rustle: (c, o) => [0, 0.1, 0.22, 0.3, 0.42].forEach((at) => noise(c, o, { at, dur: 0.14, vol: 0.4, f0: 4000, filter: "highpass", attack: 0.02 })),
  trumpet: (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    lp.connect(o);
    const osc = tone(c, lp, { type: "sawtooth", freqs: [[0, 330], [0.12, 470], [0.6, 440]], dur: 0.7, vol: 0.45, attack: 0.04 });
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = 10;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start();
    lfo.stop(c.currentTime + 0.75);
  },
  squeak: (c, o) => [0, 0.14].forEach((at) => tone(c, o, { freqs: [[0, 1300], [0.1, 1900]], at, dur: 0.12, vol: 0.35 })),
  snore: (c, o) => {
    noise(c, o, { dur: 0.9, vol: 0.5, f0: 260, f1: 180, filter: "lowpass", attack: 0.35 });
    tone(c, o, { type: "triangle", freqs: [[0, 85], [0.8, 70]], dur: 0.9, vol: 0.3, attack: 0.35 });
    tone(c, o, { freqs: [[0, 900], [0.5, 1400]], at: 1.0, dur: 0.5, vol: 0.12, attack: 0.1 });
  },
  quack: (c, o) =>
    [0, 0.22].forEach((at) => {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1100;
      bp.Q.value = 2;
      bp.connect(o);
      tone(c, bp, { type: "sawtooth", freqs: [[0, 420], [0.15, 300]], at, dur: 0.17, vol: 1, attack: 0.01 });
    }),
  meow: (c, o) => {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(800, c.currentTime);
    bp.frequency.exponentialRampToValueAtTime(1600, c.currentTime + 0.25);
    bp.frequency.exponentialRampToValueAtTime(700, c.currentTime + 0.6);
    bp.connect(o);
    tone(c, bp, { type: "sawtooth", freqs: [[0, 480], [0.2, 720], [0.6, 420]], dur: 0.65, vol: 1, attack: 0.05 });
  },
  giggle: (c, o) =>
    [0, 0.11, 0.22, 0.33, 0.44].forEach((at, i) => tone(c, o, { type: "triangle", freqs: [[0, 900 - i * 60], [0.07, 700 - i * 60]], at, dur: 0.09, vol: 0.45 })),
  drip: (c, o) => [0, 0.32].forEach((at) => tone(c, o, { freqs: [[0, 600], [0.07, 1500]], at, dur: 0.12, vol: 0.45, attack: 0.003 })),
};

export function playSound(id: SoundId | null | undefined) {
  if (!id || !PLAYERS[id]) return;
  const c = audio();
  if (!c) return;
  try {
    PLAYERS[id](c, out(c));
  } catch {
    /* audio is a nicety; never break the page */
  }
}

/** Say a single word slowly and clearly (for word association). */
export function sayWord(word: string, delayMs = 650) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !word) return;
  window.setTimeout(() => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.rate = 0.75;
      u.pitch = 1.15;
      window.speechSynthesis.speak(u);
    } catch {}
  }, delayMs);
}

