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
export type VoiceChoice = { id: string; name: string; note: string };
let voiceList: VoiceChoice[] = [];
const voiceListeners = new Set<(v: VoiceChoice[]) => void>();
/** The voices the reader can pick from (empty until known, or if none). */
export function onVoiceChoices(fn: (v: VoiceChoice[]) => void) {
  voiceListeners.add(fn);
  fn(voiceList);
  return () => void voiceListeners.delete(fn);
}
const VOICE_KEY = "taleo.voice";
/** The reader's chosen voice on this device (null = the default). */
export function chosenVoice(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}
export function chooseVoice(id: string) {
  try {
    localStorage.setItem(VOICE_KEY, id);
  } catch {}
}
function neuralEnabled(): Promise<boolean> {
  neuralOn ??= fetch("/api/tts")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean; voices?: VoiceChoice[] }) => {
      voiceList = d.voices ?? [];
      voiceListeners.forEach((fn) => fn(voiceList));
      return Boolean(d.enabled);
    })
    .catch(() => false)
    .then((on) => (neuralKnown = on));
  return neuralOn;
}
// Ask once, as soon as the app loads, so no tap ever waits on it: with the
// device voice, speech must start inside the tap itself (iOS drops speech
// that starts after a network round-trip).
// (On a page with a story to read, that is; anywhere else it waits until
// the page has finished arriving, so it never competes with it.)
if (typeof window !== "undefined") {
  const ask = () => void neuralEnabled();
  if (/^\/(story|store\/|shared|s\/)/.test(location.pathname)) ask();
  else if (document.readyState === "complete") setTimeout(ask, 1500);
  else window.addEventListener("load", () => setTimeout(ask, 1500), { once: true });
}

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

/** A phrase's recording, ready to play: the sound, when each word starts
 *  in it, and where the voice actually begins (recordings open with a
 *  moment of silence, which is skipped). All worked out when the clip is
 *  loaded - nothing is left to do when it's time to speak. */
interface Clip {
  buf: AudioBuffer;
  /** One per word of the text (split at spaces), in order: seconds in. */
  starts: number[];
  /** Seconds of silence before the first sound. */
  lead: number;
}
const clips = new Map<string, Promise<Clip | null>>();
/** The chosen voice, if it's one the server offers. */
const voiceParam = () => {
  // the reader's pick, else the first on the list (the default, so what's
  // ticked in the picker is what's heard)
  const v = chosenVoice();
  return v && voiceList.some((x) => x.id === v) ? v : (voiceList[0]?.id ?? null);
};
const clipKey = (text: string, kind: SpeechKind) => `${voiceParam() ?? ""}\n${kind}\n${text}`;

/** Clips asked for only "if already made": a miss there says nothing about
 *  whether the clip can be had - a real request must still ask. */
const soft = new Set<string>();
function loadClip(text: string, kind: SpeechKind, ahead = false, onlyIfMade = false): Promise<Clip | null> {
  const key = clipKey(text, kind);
  const have = clips.get(key);
  const v = voiceParam();
  const address = `/api/tts?k=${kind}&t=${encodeURIComponent(text)}${storyId ? `&s=${encodeURIComponent(storyId)}` : ""}${v ? `&v=${v}` : ""}`;
  // (`onlyIfMade`: fetch the clip if it already exists, but don't have one
  // made - for getting a page ready that may never be read aloud)
  const ask = async (only: boolean): Promise<Clip | null> => {
    try {
      const r = await fetch(`${address}${only ? "&o=1" : ""}`, ahead ? { headers: { "x-taleo-ahead": "1" } } : undefined);
      if (!r.ok || r.status === 204) return null;
      const bytes = await r.arrayBuffer();
      const c = getAudioContext();
      if (!c) return null;
      const buf = await c.decodeAudioData(bytes);
      // When each word is spoken: the server's own timings for this clip
      // (it listened to it once), or - if there are none - an estimate
      // from the clip's pauses.
      let starts: number[] | null = null;
      if (kind === "page") {
        starts = await fetch(`${address}&m=1`)
          .then((m) => (m.ok && m.status !== 204 ? (m.json() as Promise<{ starts?: number[] }>) : null))
          .then((m) => (Array.isArray(m?.starts) && m.starts.length === wordCount(text) ? m.starts : null))
          .catch(() => null);
      }
      const heard = soundOf(buf);
      return { buf, starts: starts ?? (kind === "page" ? estimatedStarts(text, buf, heard) : []), lead: heard.first };
    } catch {
      return null;
    }
  };
  let p: Promise<Clip | null>;
  if (have && (onlyIfMade || !soft.has(key))) return have;
  if (have) {
    // (it was only looked for: wait for that answer, and if it wasn't
    // there, have it made now)
    soft.delete(key);
    p = have.then((b) => b ?? ask(false));
  } else {
    if (onlyIfMade) soft.add(key);
    p = ask(onlyIfMade);
  }
  clips.set(key, p);
  // A failed clip shouldn't stay cached; keep the memory cache small.
  void p.then((b) => {
    if (b || clips.get(key) !== p) return;
    clips.delete(key);
    soft.delete(key);
  });
  if (clips.size > 80) clips.delete(clips.keys().next().value!);
  return p;
}

/** Start fetching a phrase's clip early (e.g. the page that's about to be
 *  read, or a word as it's tapped) so it plays without a pause. */
export function prefetchSpeech(text: string, kind: SpeechKind = "page", ahead = false, onlyIfMade = false) {
  const t = clean(text);
  if (!t || typeof window === "undefined") return;
  void neuralEnabled().then((on) => {
    if (on) void loadClip(t, kind, ahead, onlyIfMade);
  });
}

const USED_KEY = "taleo.readAloudUsed";
/** Whether read-aloud has been used on this device before (someone who
 *  has is likely to again, so their pages are made ready in full). */
export function readAloudUsed(): boolean {
  try {
    return localStorage.getItem(USED_KEY) === "1";
  } catch {
    return false;
  }
}
export function noteReadAloudUsed() {
  try {
    localStorage.setItem(USED_KEY, "1");
  } catch {}
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
  u.rate = kind === "word" ? 0.7 : 0.7;
  if (kind === "page") {
    u.onboundary = (e) => {
      if (!isCurrent() || e.name !== "word") return;
      // (which word that is: the last one beginning at or before it)
      let n = -1;
      for (const m of text.matchAll(/\S+/g)) {
        if ((m.index ?? 0) > e.charIndex) break;
        n++;
      }
      emit({ text, at: e.charIndex, word: n });
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
/** `word`: which word of the text (0 for the first, counting words split
 *  at spaces; -1 before the first is reached). `at`: where that word
 *  begins in the text as spoken. */
export type SpeechProgress = { text: string; at: number; word: number } | null;
const listeners = new Set<(p: SpeechProgress) => void>();
let progress: SpeechProgress = null;
function emit(p: SpeechProgress) {
  if (p?.word === progress?.word && p?.text === progress?.text) return;
  progress = p;
  listeners.forEach((l) => l(p));
}
/** Is a page being read aloud right now? */
export const isNarrating = () => progress !== null;

export function onSpeechProgress(fn: (p: SpeechProgress) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * When each word starts in a voice clip, worked out from the audio itself:
 * where speech actually begins and ends (clips have silence around them),
 * and where the voice pauses - which are lined up with the text's commas
 * and full stops, strongest pauses first. Within each phrase between
 * pauses, time is shared out by word length. Much closer than spreading
 * the clip's whole length evenly, since the reading is slow with long
 * pauses between sentences.
 */
const wordCount = (text: string) => text.match(/\S+/g)?.length ?? 0;

/** Where the voice is in a clip, from its loudness in 20ms frames: the
 *  frames themselves, how loud "quiet" is, and when the first and the last
 *  sound are (seconds). */
function soundOf(buf: AudioBuffer) {
  const data = buf.getChannelData(0);
  const hop = Math.max(1, Math.round(buf.sampleRate * 0.02));
  const rms: number[] = [];
  for (let i = 0; i < data.length; i += hop) {
    let sum = 0;
    const end = Math.min(data.length, i + hop);
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    rms.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)] || 0;
  const quiet = loud * 0.12;
  let firstFrame = rms.findIndex((r) => r > quiet);
  let lastFrame = rms.length - 1 - [...rms].reverse().findIndex((r) => r > quiet);
  if (firstFrame < 0 || loud === 0) {
    firstFrame = 0;
    lastFrame = rms.length - 1;
  }
  const sec = (hop / buf.sampleRate) || 0.02;
  return { rms, quiet, firstFrame, lastFrame, sec, first: firstFrame * sec };
}

function estimatedStarts(text: string, buf: AudioBuffer, heard: ReturnType<typeof soundOf>): number[] {
  const words = [...text.matchAll(/\S+/g)].map((m) => {
    const w = m[0];
    const strength = /[.!?]["')\]]*$/.test(w) ? 2 : /[,;:\u2014-]["')\]]*$/.test(w) ? 1 : 0;
    return { at: m.index ?? 0, weight: w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5, strength, start: 0 };
  });
  if (!words.length) return [];

  const { rms, quiet, sec } = heard;
  const first = heard.firstFrame;
  const last = heard.lastFrame;
  const frame = (t: number) => t * sec;

  // Pauses inside the speech: runs of quiet frames at least 140ms long.
  const gaps: { from: number; to: number }[] = [];
  let run = -1;
  for (let i = first; i <= last; i++) {
    if (rms[i] <= quiet) {
      if (run < 0) run = i;
    } else if (run >= 0) {
      if (i - run >= 7) gaps.push({ from: run, to: i });
      run = -1;
    }
  }

  // Pair the strongest breaks in the text with the longest pauses, in order.
  const breaks = words
    .map((w, i) => ({ i, strength: w.strength }))
    .filter((b) => b.strength > 0 && b.i < words.length - 1);
  const n = Math.min(breaks.length, gaps.length);
  const useBreaks = [...breaks].sort((a, b) => b.strength - a.strength || a.i - b.i).slice(0, n).sort((a, b) => a.i - b.i);
  const useGaps = [...gaps].sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, n).sort((a, b) => a.from - b.from);

  // Phrases (word ranges) with their stretch of audio.
  const spans: { from: number; to: number; t0: number; t1: number }[] = [];
  let w0 = 0;
  let t0 = frame(first);
  useBreaks.forEach((b, k) => {
    spans.push({ from: w0, to: b.i, t0, t1: frame(useGaps[k].from) });
    w0 = b.i + 1;
    t0 = frame(useGaps[k].to);
  });
  spans.push({ from: w0, to: words.length - 1, t0, t1: frame(last + 1) });

  for (const sp of spans) {
    const ws = words.slice(sp.from, sp.to + 1);
    const total = ws.reduce((x, w) => x + w.weight, 0) || 1;
    let t = sp.t0;
    for (const w of ws) {
      w.start = t;
      t += ((sp.t1 - sp.t0) * w.weight) / total;
    }
  }
  return words.map((w) => w.start);
}

/** The highlight follows just behind the voice, never ahead of it. */
const HIGHLIGHT_LAG_S = 0.08;

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
  if (kind === "page") emit({ text: t, at: -1, word: -1 });
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
      const clip = await loadClip(t, kind);
      if (!isCurrent()) return;
      const c = getAudioContext();
      if (clip && c) {
        if (c.state !== "running") await c.resume().catch(() => {});
        if (!isCurrent()) return;
        const src = c.createBufferSource();
        src.buffer = clip.buf;
        src.connect(c.destination);
        src.onended = done;
        // (straight to the voice: the silence a recording opens with is skipped)
        const skip = Math.max(0, Math.min(clip.lead - 0.04, clip.buf.duration - 0.1));
        src.start(0, skip);
        // Follow along word by word.
        let raf = 0;
        if (kind === "page" && clip.starts.length) {
          const places = [...t.matchAll(/\S+/g)].map((m) => m.index ?? 0);
          const starts = clip.starts;
          const t0 = c.currentTime;
          // (what's heard trails what's been handed to the speaker - by a
          // little on a phone, by a lot through wireless earphones)
          const behind = () => HIGHLIGHT_LAG_S + ((c as AudioContext & { outputLatency?: number }).outputLatency || c.baseLatency || 0);
          let i = -1;
          const tick = () => {
            if (!isCurrent()) return;
            const el = c.currentTime - t0 + skip - behind();
            // (only ever forwards, a word at a time or more)
            while (i + 1 < starts.length && starts[i + 1] <= el) i++;
            emit({ text: t, at: i < 0 ? -1 : (places[i] ?? 0), word: i });
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
