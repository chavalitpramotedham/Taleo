"use client";
import { useEffect, useRef, useState } from "react";
import { chooseVoice, chosenVoice, onVoiceChoices, type VoiceChoice } from "@/lib/speech";
import { SpeechIcon } from "./Icons";

/** Read-aloud as a two-part pill, like the music one: the left half turns
 *  the voice on and off, the right half (a small arrow) opens a picker of
 *  voices, the current one ticked. Without voices to choose from it's just
 *  the on/off button. */
export function ReadAloudControl({
  on,
  speaking,
  onToggle,
  onArm,
  onVoiceChange,
}: {
  on: boolean;
  speaking: boolean;
  onToggle: () => void;
  /** the button has been touched (the press isn't complete yet) */
  onArm?: () => void;
  /** a new voice was picked (the page is read again in it) */
  onVoiceChange: () => void;
}) {
  const [voices, setVoices] = useState<VoiceChoice[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => onVoiceChoices(setVoices), []);
  useEffect(() => setCurrent(chosenVoice()), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  // the default is the first in the list (the server's own default)
  const selected = voices.find((v) => v.id === current) ?? voices[0];
  const toggle = (
    <button
      type="button"
      className={voices.length ? "music-control-half read-control-toggle" : `icon-btn ${on ? "on" : ""}`}
      onClick={onToggle}
      // (the speaker is woken as the finger lands, a moment before the
      // press completes, so the voice has nothing to wait for)
      onPointerDown={onArm}
      aria-pressed={on}
      aria-label={on ? "Stop reading aloud" : "Read aloud"}
      title={on ? "Stop reading aloud" : "Read to me"}
    >
      <SpeechIcon on={on} speaking={speaking} />
    </button>
  );
  if (!voices.length) return toggle;

  return (
    <div className={`music-control read-control ${on ? "playing" : ""}`} ref={ref}>
      {toggle}
      <button
        type="button"
        className="music-control-half read-control-pick"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Reading voice: ${selected?.name}. Change voice`}
        title="Change the reading voice"
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className={`category-caret ${open ? "up" : ""}`}>
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="music-dropdown read-control-menu" role="menu">
          <p className="music-dropdown-label">Reading voice</p>
          {voices.map((v) => (
            <button
              key={v.id}
              type="button"
              role="menuitemradio"
              aria-checked={v.id === selected?.id}
              className={`music-dropdown-item ${v.id === selected?.id ? "on" : ""}`}
              onClick={() => {
                chooseVoice(v.id);
                setCurrent(v.id);
                setOpen(false);
                onVoiceChange();
              }}
            >
              {v.name} <span className="read-control-note">{v.note}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
