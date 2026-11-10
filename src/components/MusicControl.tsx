"use client";
import { useEffect, useRef, useState } from "react";
import { wakeAudio } from "@/lib/audio-context";
import { MUSIC_TRACKS, defaultTrack, playMusic, setMusicMuted, stopMusic, trackById } from "@/lib/music";
import { MusicNoteIcon, SpeakerIcon } from "./Icons";

// The reader's last tune, remembered on this device so it's ready when
// they turn the music on. (Every story starts with the music off.)
const TRACK_KEY = "taleo.music.track";

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Gentle looping background music for the story reader: a two-zone pill -
 *  the left half opens a picker to change the tune (and, on wider screens,
 *  shows the tune's name), the right half turns it on and off. Every story
 *  starts with it off: the player is still set up on mount with the
 *  reader's last-chosen tune (media-style playback, so the silent switch
 *  doesn't mute it on iPhone), and the tap that turns it on starts it at
 *  once. Stops when the reader unmounts. */
export function MusicControl() {
  const [trackId, setTrackId] = useState(defaultTrack.id);
  const [muted, setMuted] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // trackById falls back to the default for an unknown/removed tune.
    const track = trackById(readPref(TRACK_KEY) || defaultTrack.id);
    setTrackId(track.id);
    setMusicMuted(true);
    playMusic(track); // (loads it, ready - plays when turned on)
    return () => stopMusic();
  }, []);

  useEffect(() => setMusicMuted(muted), [muted]);

  const toggleMute = () => {
    // turning it on is a tap: start right here, inside the gesture
    if (muted) {
      wakeAudio();
      setMusicMuted(false);
    }
    setMuted(!muted);
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]);

  const choose = (id: string) => {
    setTrackId(id);
    setPickerOpen(false);
    writePref(TRACK_KEY, id);
    // picking a tune means they want to hear it
    if (muted) {
      wakeAudio();
      setMusicMuted(false);
      setMuted(false);
    }
    playMusic(trackById(id));
  };
  const trackName = trackById(trackId).name;

  return (
    <div className={`music-control ${muted ? "" : "playing"}`} ref={ref}>
      <button
        type="button"
        className="music-control-half music-control-tune"
        onClick={() => setPickerOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
        aria-label={`Background music: ${trackName}. Change tune`}
        title="Change background music"
      >
        <MusicNoteIcon />
        <span className="music-control-name">{trackName}</span>
      </button>
      <button
        type="button"
        className="music-control-half music-control-mute"
        onClick={toggleMute}
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
