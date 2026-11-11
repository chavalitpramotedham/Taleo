"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { AddShortcutDialog } from "./AddShortcut";

/** Who runs Taleo, as a calling card: the app's own icon (as it sits on a
 *  phone's home screen), a fine rule, then who to write to. The icon is a
 *  button: it opens the sheet that shows how to put Taleo on the home
 *  screen. */
export function FounderCard() {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <address className="policy-card" aria-label="Who runs Taleo">
        <button type="button" className="policy-card-icon-btn" onClick={() => setAdding(true)} aria-label="Add Taleo to your home screen" title="Add Taleo to your home screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="policy-card-icon" src="/icon-192.png?v=2" alt="" width={192} height={192} loading="lazy" decoding="async" />
        </button>
        <span className="policy-card-rule" aria-hidden />
        <span className="policy-card-who">
          <b>Chavalit Pramotedham</b>
          <span className="policy-card-role">Associate Dad &amp; Vibe-Coder</span>
          <a href="mailto:taleostories.dev@gmail.com">taleostories.dev@gmail.com</a>
          <span className="policy-card-site">taleo-stories.app</span>
        </span>
      </address>
      {adding && createPortal(<AddShortcutDialog onClose={() => setAdding(false)} />, document.body)}
    </>
  );
}
