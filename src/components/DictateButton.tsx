"use client";
import { useEffect, useRef, useState } from "react";
import { MicIcon } from "./Icons";
import { holdMusic } from "@/lib/music";

// Minimal typing for the (still vendor-prefixed) Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Microphone button that fills a text field by voice (hidden if unsupported). */
export function DictateButton({ onText, label = "Speak" }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
    return () => {
      recRef.current?.stop();
      holdMusic("mic", false);
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = navigator.language || "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim());
    // The mic can knock background music off; hold it while listening and
    // let it pick straight back up afterwards.
    const done = () => {
      setListening(false);
      holdMusic("mic", false);
    };
    rec.onend = done;
    rec.onerror = done;
    recRef.current = rec;
    setListening(true);
    holdMusic("mic", true);
    try {
      rec.start();
    } catch {
      done();
    }
  };

  return (
    <button
      type="button"
      className={`mic ${listening ? "listening" : ""}`}
      onClick={toggle}
      aria-label={listening ? "Stop listening" : label}
      title={listening ? "Listening… tap to stop" : label}
    >
      <MicIcon />
    </button>
  );
}
