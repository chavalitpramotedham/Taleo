"use client";
import { useEffect } from "react";
import { unlockAudio } from "@/lib/sfx";
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
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("touchend", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
