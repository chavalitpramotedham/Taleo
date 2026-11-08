"use client";
import { useEffect, useRef, useState } from "react";
import { MicIcon, StopIcon } from "./Icons";
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
  onresult: ((e: { resultIndex?: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function recognitionCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, Ctor | undefined>;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Longest a single dictation may stay open (a safety net if left on). */
const MAX_MS = 3 * 60 * 1000;
/** If the browser hasn't confirmed it's listening by then, give up. */
const START_TIMEOUT_MS = 5000;
/** A pause before reopening the mic after the browser closed it. */
const RESTART_DELAY_MS = 250;
/** Too many failed reopenings in a row: stop rather than loop. */
const MAX_RESTART_FAILS = 4;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** Only one dictation may be live in the whole app at a time (browsers
 *  refuse a second recogniser while the first is still shutting down). */
let activeStop: (() => void) | null = null;

/**
 * Microphone button that fills a text field by voice (hidden if
 * unsupported). Tap it and it becomes a stop button: it keeps listening -
 * pauses and all - until tapped again. Browsers close the microphone on
 * their own after a silence, so whenever that happens mid-dictation a new
 * recogniser is opened straight away and carries on from the words already
 * heard. Tapping stop always ends it cleanly, whatever state it's in.
 */
export function DictateButton({ onText, label = "Speak" }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    return () => stopRef.current?.();
  }, []);

  if (!supported) return null;

  const start = () => {
    const Rec = recognitionCtor();
    if (!Rec) return;
    activeStop?.(); // end any other field's dictation first

    let stopped = false;
    let committed = ""; // words from earlier sessions of this dictation
    let rec: SpeechRecognitionLike | null = null;
    let fails = 0;
    let heard = false; // the browser confirmed it's listening at least once
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    const detach = (r: SpeechRecognitionLike | null) => {
      if (!r) return;
      r.onstart = r.onresult = r.onend = r.onerror = null;
      try {
        r.abort();
      } catch {}
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      const r = rec;
      rec = null;
      if (r) {
        // Ask it to finish (so the last words come through), then let go.
        r.onend = r.onerror = r.onstart = null;
        try {
          r.stop();
        } catch {}
        window.setTimeout(() => detach(r), 1200);
      }
      if (activeStop === stop) activeStop = null;
      if (stopRef.current === stop) stopRef.current = null;
      setListening(false);
      holdMusic("mic", false);
    };

    const open = () => {
      if (stopped) return;
      const r = new Rec();
      rec = r;
      r.lang = navigator.language || "en-GB";
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 1;
      let session = "";

      r.onstart = () => {
        heard = true;
        fails = 0;
      };
      r.onresult = (e) => {
        session = tidy(
          Array.from(e.results)
            .map((x) => x[0]?.transcript ?? "")
            .join(" "),
        );
        const text = tidy(`${committed} ${session}`);
        if (text) onTextRef.current(text);
      };
      r.onerror = (e) => {
        const err = e?.error;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setHint(heard ? "Tap the mic to carry on." : "Allow microphone access to use your voice.");
          stop();
        } else if (err === "audio-capture") {
          setHint("The microphone is busy. Try again in a moment.");
          stop();
        } else if (err === "network") {
          setHint("Voice typing needs an internet connection.");
          stop();
        }
        // "no-speech" / "aborted": the end event follows and reopens.
      };
      r.onend = () => {
        if (stopped || rec !== r) return;
        // The browser closed the mic (usually after a silence): keep what
        // was heard and open a fresh one to carry on listening.
        committed = tidy(`${committed} ${session}`);
        detach(r);
        rec = null;
        if (++fails > MAX_RESTART_FAILS) {
          setHint("Tap the mic to carry on.");
          return stop();
        }
        later(open, RESTART_DELAY_MS);
      };

      try {
        r.start();
      } catch {
        detach(r);
        rec = null;
        if (++fails > MAX_RESTART_FAILS) return stop();
        later(open, RESTART_DELAY_MS * 2);
      }
    };

    // Pause the background music while the mic is open: on phones, music
    // playing can stop the microphone from starting.
    holdMusic("mic", true, { pause: true });
    activeStop = stop;
    stopRef.current = stop;
    setHint(null);
    setListening(true);
    later(() => !heard && (setHint("Couldn't start the microphone. Try again?"), stop()), START_TIMEOUT_MS);
    later(stop, MAX_MS);
    open();
  };

  return (
    <span className="mic-wrap">
      <button
        type="button"
        className={`mic ${listening ? "listening" : ""}`}
        onClick={() => (listening ? stopRef.current?.() ?? setListening(false) : start())}
        aria-label={listening ? "Stop listening" : label}
        aria-pressed={listening}
        title={listening ? "Listening… tap to stop" : label}
      >
        {listening ? <StopIcon /> : <MicIcon />}
      </button>
      {hint && (
        <span className="mic-hint" role="status">
          {hint}
        </span>
      )}
    </span>
  );
}
