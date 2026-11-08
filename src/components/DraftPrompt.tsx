"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Story } from "@/lib/types";
import { deleteStory, getStory, saveStory } from "@/lib/storage";
import { discardDraft, fetchDraft } from "@/lib/drafts-client";
import { allPages } from "@/lib/story-utils";
import { Painting } from "./art/Painting";
import { MapleMark } from "./Icons";

const ASKED = "taleo.draftAsked";

/**
 * On a visit after leaving a story unfinished (on any device): "Pick up
 * where you left off?" - Resume opens it again (finishing it publishes it
 * as usual; leaving it unfinished again brings this back next visit),
 * Discard deletes it for good. Asked once per visit; closing the popup
 * just means "not now".
 */
export function DraftPrompt() {
  const { status } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [draft, setDraft] = useState<Story | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || path.startsWith("/story/")) return;
    try {
      if (sessionStorage.getItem(ASKED)) return;
      sessionStorage.setItem(ASKED, "1");
    } catch {}
    let live = true;
    void fetchDraft().then((d) => live && d && setDraft(d));
    return () => {
      live = false;
    };
  }, [status, path]);

  if (!draft) return null;

  const resume = () => {
    // Use whichever copy is further along: this device's, or the account's.
    const local = getStory(draft.id);
    const newer = local && (local.updatedAt ?? 0) > (draft.updatedAt ?? 0) ? local : draft;
    saveStory(newer);
    setDraft(null);
    router.push(`/story/${draft.id}`);
  };
  const discard = async () => {
    setBusy(true);
    await discardDraft(draft.id);
    deleteStory(draft.id);
    setDraft(null);
  };

  const cover = allPages(draft).find((p) => p.svg)?.svg ?? null;
  const pages = allPages(draft).length;

  return (
    <div className="modal-backdrop" onClick={() => setDraft(null)}>
      <div className="modal-panel draft-prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Unfinished story">
        <div className="modal-head">
          <h3>Pick up where you left off?</h3>
          <button type="button" className="icon-btn" onClick={() => setDraft(null)} aria-label="Not now">
            ✕
          </button>
        </div>
        {cover && <Painting svg={cover} title={draft.title} className="draft-cover" />}
        <p className="draft-title">{draft.title || `${draft.hero.name}'s story`}</p>
        <p className="meta">
          Starring {draft.hero.name}
          {pages ? ` · ${pages} page${pages === 1 ? "" : "s"} so far` : ""}
        </p>
        <div className="story-preview-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={resume} disabled={busy}>
            <MapleMark />
            Resume the story
          </button>
          <button type="button" className="btn btn-soft btn-block" onClick={discard} disabled={busy}>
            Discard it
          </button>
        </div>
      </div>
    </div>
  );
}
