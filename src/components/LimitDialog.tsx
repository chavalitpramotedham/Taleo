"use client";
import { useEscape } from "@/lib/useEscape";
import Link from "next/link";
import type { ReactNode } from "react";

/** What the server says when a new story can't begin (see /api/story). */
export interface LimitNotice {
  /** Which allowance ran out: finished-or-decided stories, or beginnings. */
  limited?: string;
  /** The plan's name ("Free"). */
  plan?: string;
  /** The server's own, friendly explanation (with how long to wait). */
  message: string;
}

/**
 * "That's this week's story": shown when the plan's allowance for new stories
 * is used up. Says so kindly, and offers what can still be done - carry on
 * with the story under way, read from the library, or look at the plans.
 */
export function LimitDialog({ notice, onClose, children }: { notice: LimitNotice; onClose: () => void; children?: ReactNode }) {
  const title = notice.limited === "busy" ? "A story is under way elsewhere" : notice.limited === "start" ? "Let's finish one first" : "That's this week's story!";
  useEscape(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel draft-prompt limit-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Story limit reached">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="limit-message">{notice.message}</p>
        <div className="story-preview-actions">
          {children}
          <Link className="btn btn-soft btn-block" href="/store">
            Read from the library
          </Link>
          <Link className="btn btn-soft btn-block" href="/account/plans">
            See plans
          </Link>
        </div>
      </div>
    </div>
  );
}
