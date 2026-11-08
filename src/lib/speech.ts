"use client";
import { getAudioContext } from "./audio-context";
import { duckMusic, holdMusic } from "./music";

// Read-aloud for the stories and the tappable words, in a calm, well-spoken
// British woman's voice.
//
//  1. Neural voice (preferred): when the server has a text-to-speech key,
//     each phrase comes from /api/tts as an MP3 (cached server-side and by
//     the browser) and plays through the shared Web Audio context - the same
//     natural voice on every device, and no gesture problems on iOS once
//     that context is unlocked.
//  2. Browser voice (fallback): speechSynthesis with the best British female
//     voice the device has, at a natural pitch and unhurried pace.
//
// Background music is softened while speaking, so the voice sits on top.

export type SpeechKind = "page" | "word";

// ---------------------------------------------------------------- neural voice

let neuralOn: Promise<boolean> | null = null;
/** Settled answer once known: true/false, or null while still checking. */
let neuralKnown: boolean | null = null;
function neuralEnabled(): Promise<boolean> {
  neuralOn ??= fetch("/api/tts")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => Boolean(d.enabled))
    .catch(() => false)
    .then((on) => (neuralKnown = on));
  return neuralOn;
}
// Ask once, as soon as the app loads, so no tap ever waits on it: with the
// device voice, speech must start inside the tap itself (iOS drops speech
// that starts after a network round-trip).
if (typeof window !== "undefined") void neuralEnabled();

/** True when speech will use the device's own voice, which on iOS must be
 *  started synchronously inside the user's tap. */
export const usesDeviceVoice = () => neuralKnown !== true;

// The story being read, sent with clip requests so signed-out readers of a
// published story can still hear it in the neural voice (the server only
// makes clips from that story's own words).
let storyId: string | null = null;
export function setSpeechStory(id: string | null) {
  storyId = id;
}

const clips = new Map<string, Promise<AudioBuffer | null>>();
const clipKey = (text: string, kind: SpeechKind) => `${kind}\n${text}`;

function loadClip(text: string, kind: SpeechKind): Promise<AudioBuffer | null> {
  const key = clipKey(text, kind);
  const have = clips.get(key);
  if (have) return have;
  const p = fetch(`/api/tts?k=${kind}&t=${encodeURIComponent(text)}${storyId ? `&s=${encodeURIComponent(storyId)}` : ""}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buf) => {
      const c = getAudioContext();
      return buf && c ? c.decodeAudioData(buf) : null;
    })
    .catch(() => null);
  clips.set(key, p);
  // A failed clip shouldn't stay cached; keep the memory cache small.
  void p.then((b) => b || clips.delete(key));
  if (clips.size > 80) clips.delete(clips.keys().next().value!);
  return p;
}

/** Start fetching a phrase's clip early (e.g. the page that's about to be
 *  read, or a word as it's tapped) so it plays without a pause. */
export function prefetchSpeech(text: string, kind: SpeechKind = "page") {
  const t = clean(text);
  if (!t || typeof window === "undefined") return;
  void neuralEnabled().then((on) => {
    if (on) void loadClip(t, kind);
  });
}

// ---------------------------------------------------------------- browser voice

let voices: SpeechSynthesisVoice[] = [];
let unlocked = false;

function refreshVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const list = window.speechSynthesis.getVoices();
  if (list.length) voices = list;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

// Calm, well-spoken British women's voices, best first, matched by name
// (the Web Speech API exposes no gender or quality). Covers Edge's neural
// "Online (Natural)" voices, Apple's premium/enhanced voices, Chrome's
// Google UK voice and the standard Apple/Microsoft ones.
const BRITISH_FEMALE = [
  /(sonia|libby|maisie|abbi|hollie|bella|olivia).*natural/i,
  /(serena|kate|stephanie|martha|fiona).*(premium|enhanced)/i,
  /google uk english female/i,
  /\b(serena|kate|stephanie|martha|sonia|libby|hazel|susan)\b/i,
  /\bshelley\b/i,
  /\b(flo|sandy)\b/i,
];
const MALE = /\b(daniel|arthur|oliver|george|ryan|thomas|reed|rocko|eddy|grandpa|male)\b/i;
// If there's no British voice at all: a soft female voice from nearby.
const NEARBY_FEMALE = [/(karen|moira|tessa|catherine|natasha).*(premium|enhanced)?/i, /female/i];

function pickVoice(): SpeechSynthesisVoice | undefined {
  refreshVoices();
  if (!voices.length) return undefined;
  const gb = voices.filter((v) => /^en[-_]gb/i.test(v.lang));
  for (const re of BRITISH_FEMALE) {
    const v = gb.find((x) => re.test(x.name)) ?? voices.find((x) => re.test(x.name) && /^en/i.test(x.lang));
    if (v) return v;
  }
  const anyGb = gb.find((v) => !MALE.test(v.name));
  if (anyGb) return anyGb;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  for (const re of NEARBY_FEMALE) {
    const v = en.find((x) => re.test(x.name) && !MALE.test(x.name));
    if (v) return v;
  }
  return gb[0] ?? en.find((v) => v.default) ?? en[0];
}

/** Call synchronously inside a real click/tap handler to allow later speech on iOS. */
export function unlockSpeech() {
  if (unlocked || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {}
}

function browserSpeak(text: string, kind: SpeechKind, isCurrent: () => boolean, done: () => void) {
  if (!("speechSynthesis" in window)) return done();
  const ss = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  u.lang = voice?.lang || "en-GB";
  if (voice) u.voice = voice;
  // Natural pitch (raising it is what made the old voice sound robotic),
  // and an unhurried pace; single words a touch slower and clearer.
  u.pitch = 1;
  // Slow and gentle, like reading to a baby.
  u.rate = kind === "word" ? 0.7 : 0.76;
  if (kind === "page") {
    u.onboundary = (e) => {
      if (isCurrent() && e.name === "word") emit({ text, at: e.charIndex });
    };
  }
  u.onend = done;
  u.onerror = done;
  // Hold the music watchdog while the system voice speaks (on some phones
  // forcing music back on mid-sentence would cut the voice off).
  holdMusic("speech", true);
  // Some browsers get stuck "speaking" - e.g. after the silent unlock
  // utterance never finishes - and then silently drop anything queued
  // behind it. Reset first; if it was busy, give it a beat to settle.
  const busy = ss.speaking || ss.pending || ss.paused;
  ss.cancel();
  ss.resume();
  if (busy) window.setTimeout(() => isCurrent() && ss.speak(u), 120);
  else ss.speak(u);
}

// ---------------------------------------------------------------- read-along
// Which word is being read right now (for highlighting it, karaoke-style):
// the text being spoken and the character index of the current word, or
// null when nothing is being read.
export type SpeechProgress = { text: string; at: number } | null;
const listeners = new Set<(p: SpeechProgress) => void>();
let progress: SpeechProgress = null;
function emit(p: SpeechProgress) {
  if (p?.at === progress?.at && p?.text === progress?.text) return;
  progress = p;
  listeners.forEach((l) => l(p));
}
export function onSpeechProgress(fn: (p: SpeechProgress) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Estimated start time of each word in a clip of known length: time is
 *  shared out by word length, plus pauses after commas and sentence ends
 *  (the voice reads slowly, with long pauses between sentences). */
function wordTimings(text: string, duration: number) {
  const words = [...text.matchAll(/\S+/g)].map((m) => {
    const w = m[0];
    const pause = /[.!?]["')\]]*$/.test(w) ? 7 : /[,;:\u2014-]["')\]]*$/.test(w) ? 3 : 0;
    return { at: m.index ?? 0, weight: w.replace(/[^\p{L}\p{N}]/gu, "").length + 2 + pause };
  });
  const total = words.reduce((n, w) => n + w.weight, 0) || 1;
  const lead = Math.min(0.25, duration * 0.04); // a breath before the first word
  let t = lead;
  return words.map((w) => {
    const start = t;
    t += ((duration - lead) * w.weight) / total;
    return { at: w.at, start };
  });
}

// ---------------------------------------------------------------- speaking

let token = 0;
let stopCurrent: (() => void) | null = null;
let safety: number | undefined;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** Read some text aloud ("page" for story text, "word" for a single
 *  tapped word). Interrupts anything already being spoken. */
export function speakText(text: string, { kind = "page" }: { kind?: SpeechKind } = {}) {
  const t = clean(text);
  if (!t || typeof window === "undefined") return;
  cancelSpeech();
  const my = ++token;
  const isCurrent = () => my === token;
  const done = () => {
    if (!isCurrent()) return;
    window.clearTimeout(safety);
    stopCurrent = null;
    emit(null);
    duckMusic("speech", false);
    holdMusic("speech", false);
  };
  duckMusic("speech", true);
  // A page being read: say so straight away (the speaker icon pulses), with
  // no word lit until the voice reaches the first one.
  if (kind === "page") emit({ text: t, at: -1 });
  // Safety net in case an end event never arrives.
  safety = window.setTimeout(done, Math.min(90000, 4000 + t.length * 110));

  // Device voice (no neural voice configured): speak right now, still
  // inside the caller's tap, rather than after an await.
  if (neuralKnown === false) {
    browserSpeak(t, kind, isCurrent, done);
    return;
  }

  void (async () => {
    if (await neuralEnabled()) {
      const buf = await loadClip(t, kind);
      if (!isCurrent()) return;
      const c = getAudioContext();
      if (buf && c) {
        if (c.state === "suspended") await c.resume().catch(() => {});
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.onended = done;
        src.start();
        // Follow along word by word (estimated from the clip's length).
        let raf = 0;
        if (kind === "page") {
          const marks = wordTimings(t, buf.duration);
          const t0 = c.currentTime;
          const tick = () => {
            if (!isCurrent()) return;
            const el = c.currentTime - t0;
            let i = 0;
            while (i + 1 < marks.length && marks[i + 1].start <= el) i++;
            emit({ text: t, at: marks[i]?.at ?? 0 });
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
        stopCurrent = () => {
          cancelAnimationFrame(raf);
          src.onended = null;
          try {
            src.stop();
          } catch {}
        };
        const ended = src.onended;
        src.onended = (ev) => {
          cancelAnimationFrame(raf);
          ended?.call(src, ev);
        };
        return;
      }
    }
    if (isCurrent()) browserSpeak(t, kind, isCurrent, done);
  })();
}

export function cancelSpeech() {
  if (typeof window === "undefined") return;
  token++;
  window.clearTimeout(safety);
  stopCurrent?.();
  stopCurrent = null;
  emit(null);
  duckMusic("speech", false);
  holdMusic("speech", false);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
