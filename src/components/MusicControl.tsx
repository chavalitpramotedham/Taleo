"use client";
import { useEffect, useRef, useState } from "react";
import { MUSIC_TRACKS, playMusic, recommendTrack, setMusicMuted, stopMusic, trackById } from "@/lib/music";
import { MusicNoteIcon, SpeakerIcon } from "./Icons";

/** Gentle looping background music for the story reader: a two-zone pill -
 *  the left half opens a picker to change the tune, the right half mutes
 *  it. Starts on mount with a track recommended from the story's theme,
 *  and stops when the reader unmounts. */
export function MusicControl({ theme }: { theme: string }) {
  const [trackId, setTrackId] = useState(() => recommendTrack(theme).id);
  const [muted, setMuted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    playMusic(trackById(trackId));
    return () => stopMusic();
    // Only the very first mount should auto-start on the recommendation;
    // later track changes are handled by the picker's own onClick below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setMusicMuted(muted), [muted]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  const choose = (id: string) => {
    setTrackId(id);
    setPickerOpen(false);
    playMusic(trackById(id));
  };

  return (
    <div className="music-control" ref={ref}>
      <button
        type="button"
        className="music-control-half music-control-tune"
        onClick={() => setPickerOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
        aria-label="Change background music"
        title="Change background music"
      >
        <MusicNoteIcon />
      </button>
      <button
        type="button"
        className="music-control-half music-control-mute"
        onClick={() => setMuted((m) => !m)}
        aria-pressed={muted}
        aria-label={muted ? "Unmute background music" : "Mute background music"}
        title={muted ? "Unmute music" : "Mute music"}
      >
        <SpeakerIcon on={!muted} />
      </button>
      {pickerOpen && (
        <div className="music-dropdown" role="menu">
          <p className="music-dropdown-label">Background music</p>
          {MUSIC_TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`music-dropdown-item ${t.id === trackId ? "on" : ""}`}
              role="menuitemradio"
              aria-checked={t.id === trackId}
              onClick={() => choose(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
