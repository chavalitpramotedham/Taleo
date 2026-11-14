"use client";
import { useEffect } from "react";
import { unlockAudio } from "@/lib/sfx";
import { prewarmAudio, sleepAudio, stirAudio, wakeAudio } from "@/lib/audio-context";
import { holdMusic } from "@/lib/music";
import { cancelSpeech } from "@/lib/speech";
import { unlockSpeech } from "@/lib/speech";

/** Primes Web Audio and speech synthesis on the very first tap anywhere in
 *  the app. iOS Safari (especially a home-screen "standalone" web app) only
 *  lets audio start inside a real user gesture, and leaving it to whichever
 *  component happens to need sound first means a page's own first tap can
 *  arrive too late or get missed. Doing it here, once, as early as possible
 *  gives every later sound effect and spoken word the best chance to work. */
export function AudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      unlockSpeech();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("keydown", unlock);
    };
    // (the slow part - making the audio - done in a quiet moment after the
    // page has loaded, not in the first tap: see prewarmAudio)
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    let idle = 0;
    const later = window.setTimeout(() => (idle = ric(prewarmAudio, { timeout: 3000 }) as number), 2500);
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("touchend", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    // Every later tap too: wake the audio if the phone has parked it, so
    // sounds that start a moment after a tap (a page read aloud after the
    // turn) still play - silent mode included.
    window.addEventListener("pointerdown", wakeAudio, { passive: true });
    window.addEventListener("touchend", wakeAudio, { passive: true });
    // Leaving the app stops all sound - the music pauses (and stays paused
    // rather than being nudged back on), any reading stops; coming back
    // picks the music up again.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        holdMusic("hidden", true, { pause: true });
        cancelSpeech();
        sleepAudio();
      } else {
        stirAudio();
        holdMusic("hidden", false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      window.clearTimeout(later);
      if (idle) (window.cancelIdleCallback ?? clearTimeout)(idle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
      window.removeEventListener("pointerdown", wakeAudio);
      window.removeEventListener("touchend", wakeAudio);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
