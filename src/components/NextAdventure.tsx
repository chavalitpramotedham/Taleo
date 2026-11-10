"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { SavedCharacter } from "@/lib/types";
import { tierIdFor } from "@/lib/tiers";
import { quotaLine, useStoryAllowance } from "@/lib/allowance";
import { useOngoingStory } from "@/lib/ongoing";
import {
  IDEA_EVENT,
  type NextIdea,
  forgetIdea,
  freshIdea,
  handOver,
  ideaByKey,
  ideaPitch,
  nameList,
  saveIdea,
  savedIdea,
  takeJustFinished,
} from "@/lib/ideas";
import { CharacterPortrait } from "./art/Painting";
import { MapleMark } from "./Icons";

/** The family's own characters (one free read); none if it can't be had. */
const ownCharacters = () =>
  fetch("/api/characters")
    .then((r) => (r.ok ? r.json() : { characters: [] }))
    .then((d: { characters?: SavedCharacter[] }) => d.characters ?? [])
    .catch(() => [] as SavedCharacter[]);

/** The idea put away for later on this device (null: none; undefined:
 *  still looking). */
export function useSavedIdea(): NextIdea | null | undefined {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [idea, setIdea] = useState<NextIdea | null | undefined>(undefined);
  useEffect(() => {
    if (status === "loading") return;
    if (!userId) return setIdea(null);
    const look = () => setIdea(savedIdea(userId));
    look();
    window.addEventListener(IDEA_EVENT, look);
    return () => window.removeEventListener(IDEA_EVENT, look);
  }, [status, userId]);
  return idea;
}

function Cast({ idea }: { idea: NextIdea }) {
  return (
    <div className="idea-cast">
      {idea.cast.map((c) => (
        <figure key={c.uid}>
          <CharacterPortrait character={c} />
          <figcaption>{c.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * A story idea, offered: who it's about, what happens, and what to do
 * with it - begin it now, change it first (the wizard opens with it
 * filled in), or put it away for later. With the plan's stories used up
 * there's no "Start now": it can only be kept, with a word on when the
 * next story can begin.
 */
export function IdeaDialog({
  idea,
  saved,
  onClose,
  onAnother,
  onSaved,
}: {
  idea: NextIdea;
  /** It's the one already put away for later (opened from its card). */
  saved: boolean;
  onClose: () => void;
  /** Swap it for a different idea. */
  onAnother?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const allowance = useStoryAllowance();
  const concept = ideaByKey(idea.key);
  if (!concept || !userId) return null;
  const spent = quotaLine(allowance);
  // On Free a story begun now is the day's only one: keeping the idea for
  // tomorrow is the first thing offered.
  const keepFirst = !saved && tierIdFor(session.user) === "free";

  const open = (go: boolean) => {
    handOver(idea, go);
    onClose();
    router.push("/create");
  };
  const keep = () => {
    saveIdea(userId, idea);
    // (whoever shows the "saved" word closes the dialog themselves)
    if (onSaved) onSaved();
    else onClose();
  };
  const startBtn = (primary: boolean) => (
    <button key="start" type="button" className={`btn ${primary ? "btn-primary" : "btn-soft"} btn-block`} onClick={() => open(true)}>
      {primary && <MapleMark />}
      Start now
    </button>
  );
  const keepBtn = (primary: boolean) => (
    <button key="keep" type="button" className={`btn ${primary ? "btn-primary" : "btn-soft"} btn-block`} onClick={keep}>
      {primary && <MapleMark />}
      Save for later
    </button>
  );
  const changeBtn = (
    <button key="change" type="button" className="btn btn-soft btn-block" onClick={() => open(false)}>
      Change it first
    </button>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel draft-prompt idea-prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="A story idea">
        <div className="modal-head">
          <h3>{saved ? "Your saved story idea" : "Start a new adventure now?"}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Not now">
            ✕
          </button>
        </div>
        <Cast idea={idea} />
        <p className="draft-title">{concept.title}</p>
        <p className="meta idea-pitch">{ideaPitch(idea)}</p>
        <div className="story-preview-actions">
          {spent ? (
            saved ? (
              <button type="button" className="btn btn-soft btn-block" onClick={onClose}>
                Keep it for later
              </button>
            ) : (
              keepBtn(true)
            )
          ) : saved ? (
            [startBtn(true), changeBtn]
          ) : keepFirst ? (
            [keepBtn(true), startBtn(false), changeBtn]
          ) : (
            [startBtn(true), changeBtn, keepBtn(false)]
          )}
        </div>
        {spent && (
          <p className="quota-note" role="note">
            {spent}
          </p>
        )}
        {!saved && <p className="meta starts-left">A saved idea waits on your home page, on this device. Saving it doesn&apos;t use up a story.</p>}
        <p className="meta idea-other">
          {saved ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                forgetIdea(userId);
                onClose();
              }}
            >
              Remove this idea
            </button>
          ) : (
            onAnother && (
              <button type="button" className="link-btn" onClick={onAnother}>
                Show me another idea
              </button>
            )
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Back on the bookshelf after reading a story of one's own to its end:
 * "Start a new adventure now?" - one fresh idea (or the one already put
 * away for later). Asked once per story finished; closing it is "not now".
 */
export function NextAdventure() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const path = usePathname();
  const here = path === "/home" || path === "/my-stories";
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !here) return;
    if (takeJustFinished()) setDue(true);
  }, [status, here, path]);

  if (!due || !userId || !here) return null;
  return <Offer userId={userId} onDone={() => setDue(false)} />;
}

function Offer({ userId, onDone }: { userId: string; onDone: () => void }) {
  // (a story still under way has its own question to ask first)
  const { story } = useOngoingStory({ finishing: true });
  const [own, setOwn] = useState<SavedCharacter[] | null>(null);
  const [idea, setIdea] = useState<{ idea: NextIdea; saved: boolean } | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let live = true;
    void ownCharacters().then((c) => live && setOwn(c));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!own || idea) return;
    const kept = savedIdea(userId);
    setIdea(kept ? { idea: kept, saved: true } : { idea: freshIdea(userId, own), saved: false });
  }, [own, idea, userId]);
  useEffect(() => {
    if (story && !toast) onDone();
  }, [story, toast, onDone]);
  const another = useCallback(() => {
    if (own) setIdea((cur) => ({ idea: freshIdea(userId, own, { not: cur?.idea.key }), saved: false }));
  }, [own, userId]);

  if (toast) return <div className="toast">Saved. It&apos;s waiting on your home page.</div>;
  if (story !== null || !idea) return null;
  return (
    <IdeaDialog
      idea={idea.idea}
      saved={idea.saved}
      onClose={onDone}
      onAnother={another}
      onSaved={() => {
        setToast(true);
        window.setTimeout(() => {
          setToast(false);
          onDone();
        }, 2600);
      }}
    />
  );
}

/**
 * The idea put away for later, as a card at the front of the bookshelf
 * row (beside the story under way, if there is one): tap it to see it
 * again and begin; the ✕ in its corner lets it go.
 */
export function IdeaCard({ idea }: { idea: NextIdea }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const concept = ideaByKey(idea.key);
  if (!concept) return null;
  return (
    <div className="book-card story-card ongoing-card idea-card">
      <button type="button" className="ongoing-open" onClick={() => setOpen(true)} aria-label={`${concept.title} - a story idea saved for later`}>
        <span className="cover idea-cover">
          <span className="idea-cover-cast">
            {idea.cast.map((c) => (
              <CharacterPortrait key={c.uid} character={c} />
            ))}
          </span>
          <span className="cover-time ongoing-badge">Story idea</span>
        </span>
        <span className="body">
          <span className="story-card-title">{concept.title}</span>
          <span className="ongoing-meta">Starring {nameList(idea.cast.map((c) => c.name))}</span>
          <span className="btn btn-primary btn-sm ongoing-cta">
            <MapleMark /> Open idea
          </span>
        </span>
      </button>
      <button
        type="button"
        className="ongoing-discard"
        onClick={() => userId && forgetIdea(userId)}
        aria-label={`Remove the idea ${concept.title}`}
        title="Remove this idea"
      >
        ✕
      </button>
      {/* (on the page itself, not inside the card: the row scrolls and the
          card lifts on hover, either of which would trap a fixed dialog) */}
      {open && createPortal(<IdeaDialog idea={idea} saved onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}
