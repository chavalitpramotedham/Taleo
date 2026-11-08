"use client";
import { holdMusic } from "./music";
// Shared browser text-to-speech: picks a warmer, more expressive voice instead
// of the flat system default, and works around two common mobile issues:
//  - voice lists load asynchronously (getVoices() is often [] on first call,
//    especially on phones), so we cache and refresh on "voiceschanged";
//  - iOS Safari only allows speechSynthesis.speak() as a direct result of a
//    user gesture. Any call made from a setTimeout/effect (even a few ms
//    later) is silently dropped. We "unlock" speech once per page with a
//    synchronous speak() inside the real click/tap handler, after which
//    later calls in that session are allowed through.

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

// Roughly best-to-worst, checked by name since the Web Speech API exposes no
// "expressiveness" signal. Covers the common warm, natural-sounding voices
// on iOS/macOS (Apple), Chrome/Android (Google) and Edge/Windows (Microsoft).
const PREFERRED = [
  /enhanced|premium|natural/i,
  /samantha/i,
  /karen|moira|tessa/i,
  /google us english/i,
  /google uk english female/i,
  /aria|jenny/i,
  /female/i,
  /google/i,
];

function pickVoice(lang?: string): SpeechSynthesisVoice | undefined {
  refreshVoices();
  if (!voices.length) return undefined;
  const base = (lang || "en").slice(0, 2).toLowerCase();
  const inLang = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = inLang.length ? inLang : voices;
  for (const re of PREFERRED) {
    const match = pool.find((v) => re.test(v.name));
    if (match) return match;
  }
  return pool.find((v) => v.localService) ?? pool[0];
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

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
}

/** Speak text with a warmer voice. Safe to call from a timeout/effect once unlockSpeech() has run. */
let speechTimer: number | undefined;
let speechToken = 0;

export function speakText(text: string, { rate = 0.92, pitch = 1.12, lang = "en-US" }: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = pitch;
    u.lang = lang;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    // Speaking can pause background music on some phones: hold the music
    // while we speak and let it resume after. (Our own flag, not
    // speechSynthesis.speaking, which some browsers leave stuck on true.)
    // The timer is a safety net in case onend never fires.
    holdMusic("speech", true);
    window.clearTimeout(speechTimer);
    const token = ++speechToken;
    // Only the latest utterance may release the hold (cancelling an older
    // one fires its onerror after the new one has started).
    const release = () => {
      if (token !== speechToken) return;
      window.clearTimeout(speechTimer);
      holdMusic("speech", false);
    };
    speechTimer = window.setTimeout(release, Math.min(60000, 2500 + text.length * 120));
    u.onend = release;
    u.onerror = release;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function cancelSpeech() {
  if (typeof window === "undefined") return;
  speechToken++;
  window.clearTimeout(speechTimer);
  holdMusic("speech", false);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
