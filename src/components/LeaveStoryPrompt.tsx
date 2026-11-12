"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEscape } from "@/lib/useEscape";
import { DRAFT_ASKED } from "@/lib/drafts-client";
import { MapleMark } from "./Icons";

/**
 * While an unfinished story is open: following a link to another page
 * first asks "Leave this story?" - saying it will be waiting on the home
 * page. Staying closes the question; leaving goes where the link led, and
 * the page arrived at doesn't then ask "Pick up where you left off?" (the
 * reader has only just chosen to put it down).
 *
 * It listens for taps on the page's own links (the menu, the title, links
 * in the story's pages). A tap that opens a new tab is left alone - the
 * story stays open in this one.
 */
export function LeaveStoryPrompt({ active, storyPath }: { active: boolean; storyPath: string }) {
  const router = useRouter();
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      // (only this site's other pages: not another site, not this story)
      if (url.origin !== location.origin || url.pathname === location.pathname || url.pathname.startsWith(storyPath)) return;
      e.preventDefault();
      e.stopPropagation();
      setTo(url.pathname + url.search + url.hash);
    };
    // (before the link's own handling, so the page doesn't change first)
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, storyPath]);
  useEscape(() => setTo(null), Boolean(to));
  if (!to) return null;
  const leave = () => {
    try {
      sessionStorage.setItem(DRAFT_ASKED, "1");
    } catch {}
    const href = to;
    setTo(null);
    router.push(href);
  };
  return (
    <div className="modal-backdrop" onClick={() => setTo(null)}>
      <div className="modal-panel draft-prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="leave-story-title">
        <div className="modal-head">
          <h3 id="leave-story-title">Leave this story?</h3>
          <button type="button" className="icon-btn" onClick={() => setTo(null)} aria-label="Stay">
            ✕
          </button>
        </div>
        <p className="limit-message">It isn&apos;t finished yet. It will wait for you on your home page, at the front of your bookshelf, to carry on whenever you like.</p>
        <div className="story-preview-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setTo(null)}>
            <MapleMark />
            Stay with the story
          </button>
          <button type="button" className="btn btn-soft btn-block" onClick={leave}>
            Leave for now
          </button>
        </div>
      </div>
    </div>
  );
}
