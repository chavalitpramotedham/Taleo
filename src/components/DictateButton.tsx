"use client";
import { useEffect, useRef, useState } from "react";
import { MicIcon } from "./Icons";
import { holdMusic } from "@/lib/music";

// Minimal typing for the (still vendor-prefixed) Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function recognitionCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, Ctor | undefined>;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// Only one recogniser may be live in the whole app at a time: browsers
// refuse (or silently fail) to start a second while the first is still
// shutting down - the classic "works once, then stops working".
let active: { rec: SpeechRecognitionLike; finish: () => void } | null = null;

/** How long silence may last after speech before we wrap up ourselves -
 *  some browsers (iOS Safari especially) never end on their own. */
const SILENCE_MS = 2200;
/** Longest a single dictation may run. */
const MAX_MS = 20000;
/** If the browser hasn't confirmed it's listening by then, start over. */
const START_TIMEOUT_MS = 4000;
/** After asking it to stop, wait this long for its end event before forcing it. */
const STOP_GRACE_MS = 900;

/** Microphone button that fills a text field by voice (hidden if unsupported). */
export function DictateButton({ onText, label = "Speak" }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const mine = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    return () => {
      if (active && active.rec === mine.current) active.finish();
    };
  }, []);

  if (!supported) return null;

  const start = () => {
    const Rec = recognitionCtor();
    if (!Rec) return;
    // Tidy up anything still running (ours from a previous tap, or another
    // field's), without waiting for it - its own timers are cleared too.
    active?.finish();

    const rec = new Rec();
    rec.lang = navigator.language || "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    const timers: number[] = [];
    let silence: number | undefined;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(silence);
      rec.onstart = rec.onresult = rec.onend = rec.onerror = null;
      try {
        rec.abort();
      } catch {}
      if (active?.rec === rec) active = null;
      if (mine.current === rec) {
        mine.current = null;
        setListening(false);
      }
      // Let the background music back in now the mic is closed.
      holdMusic("mic", false);
    };

    rec.onstart = () => {
      window.clearTimeout(timers[0]);
    };
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) onTextRef.current(text);
      // Wrap up after a pause in speaking, in case the browser doesn't.
      window.clearTimeout(silence);
      silence = window.setTimeout(() => {
        try {
          rec.stop();
        } catch {}
        timers.push(window.setTimeout(finish, STOP_GRACE_MS));
      }, SILENCE_MS);
    };
    rec.onend = finish;
    rec.onerror = (e) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setHint("Allow microphone access to use your voice.");
      } else if (e?.error === "audio-capture") {
        setHint("The microphone is busy. Try again in a moment.");
      } else if (e?.error === "network") {
        setHint("Voice typing needs an internet connection.");
      }
      finish();
    };

    // Pause the background music while the mic is open: on phones, music
    // playing can stop the microphone from starting.
    holdMusic("mic", true, { pause: true });
    active = { rec, finish };
    mine.current = rec;
    setHint(null);
    setListening(true);
    timers.push(window.setTimeout(finish, START_TIMEOUT_MS));
    timers.push(window.setTimeout(finish, MAX_MS));
    try {
      rec.start();
    } catch {
      finish();
    }
  };

  const stop = () => {
    const rec = mine.current;
    if (!rec || !active || active.rec !== rec) {
      // The UI thought it was listening but nothing is: just reset.
      setListening(false);
      return;
    }
    const { finish } = active;
    try {
      rec.stop();
    } catch {}
    // Don't trust the end event to arrive: force the reset shortly after.
    window.setTimeout(finish, STOP_GRACE_MS);
  };

  return (
    <span className="mic-wrap">
      <button
        type="button"
        className={`mic ${listening ? "listening" : ""}`}
        onClick={listening ? stop : start}
        aria-label={listening ? "Stop listening" : label}
        title={listening ? "Listening… tap to stop" : label}
      >
        <MicIcon />
      </button>
      {hint && (
        <span className="mic-hint" role="status">
          {hint}
        </span>
      )}
    </span>
  );
}
