"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CharacterDef, CharacterGender, SavedCharacter } from "@/lib/types";
import { GenderPicker } from "@/components/GenderPicker";
import { CharacterPortrait } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { GrowingInput } from "@/components/GrowingInput";
import { LeafLoader, MapleMark } from "@/components/Icons";
import { NOTES_MAX } from "@/lib/characters";
import { PaintingCancelled, requestCharacter, type CharacterProgress } from "@/lib/character-client";
import { CreditCost, useCharacterCredits } from "@/components/CreditCost";
import { StopPaintingConfirm, useLeaveWarning } from "@/components/StopPaintingConfirm";
import { CharacterProgressBar } from "@/components/CharacterProgressBar";
import { PhotoProblem, preparePhoto, type CharacterPhoto } from "@/lib/character-photo";

type ChosenPhoto = CharacterPhoto & { preview: string; bytes: number };

interface Props {
  onClose: () => void;
  /** Called once the character is actually saved to the roster. */
  onConfirmed: (character: SavedCharacter) => void;
  /** The signed-in user's current roster, for the at-cap replace picker. */
  existing: SavedCharacter[];
}

/** Describe → preview → (edit the description and regenerate, or rename) →
 *  confirm. Nothing is saved until "Confirm & save" - previewing and
 *  regenerating only ever call the no-save /api/character design
 *  endpoint, so confirming persists exactly what was last previewed,
 *  never a fresh redesign. */
export function CharacterCreatorModal({ onClose, onConfirmed, existing }: Props) {
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [relationships, setRelationships] = useState("");
  const prefilled = useRef("");
  const [gender, setGender] = useState<CharacterGender | null>(null);
  const [drafted, setDrafted] = useState<CharacterDef | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [progress, setProgress] = useState<CharacterProgress | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An optional photo of who or what they are, to paint them from (kept
  // only on this screen, sent only with the painting request).
  const [photo, setPhoto] = useState<ChosenPhoto | null>(null);
  // What was wrong with the photo, when it couldn't be used.
  const [photoTrouble, setPhotoTrouble] = useState<string | null>(null);
  const pickPhoto = useRef<(() => void) | null>(null);

  // Leaving while they're being painted asks first: stopping throws the
  // painting away, staying lets it finish.
  const [askStop, setAskStop] = useState(false);
  const painting = useRef<AbortController | null>(null);
  const close = () => (drawing ? setAskStop(true) : onClose());
  const closeRef = useRef(close);
  closeRef.current = close;
  const stopAndClose = () => {
    painting.current?.abort();
    onClose();
  };
  useLeaveWarning(drawing);
  useEffect(() => () => painting.current?.abort(), []);
  useEffect(() => {
    if (!drawing) setAskStop(false);
  }, [drawing]);

  const askRef = useRef(false);
  askRef.current = askStop;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // (over the question, Escape means "keep painting")
      if (askRef.current) setAskStop(false);
      else closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // (what the next painting costs in credits, if anything)
  const cost = useCharacterCredits();
  const draw = async (opts: { withoutPhoto?: boolean } = {}) => {
    if (!description.trim() || drawing) return;
    const sending = opts.withoutPhoto ? null : photo;
    if (opts.withoutPhoto) setPhoto(null);
    setDrawing(true);
    setProgress(null);
    setError(null);
    setPhotoTrouble(null);
    const mine = (painting.current = new AbortController());
    try {
      const data = await requestCharacter(
        { description, name: name.trim() || undefined, photo: sending ? { data: sending.data, type: sending.type } : undefined },
        setProgress,
        { signal: mine.signal },
      );
      setDrafted(data.character);
      setName(data.character.name);
      // The description they were painted from is kept as their prompt
      // (shown in its own box); "About" is left for extra details.
      prefilled.current = description.trim();
    } catch (e) {
      if (e instanceof PhotoProblem) setPhotoTrouble(e.message);
      else if (!(e instanceof PaintingCancelled)) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (painting.current === mine) painting.current = null;
      setDrawing(false);
      cost.again(); // (the free one may just have been used)
    }
  };
  const photoField = (
    <PhotoField
      photo={photo}
      onChange={(p) => {
        setPhoto(p);
        setPhotoTrouble(null);
      }}
      disabled={drawing || confirming}
      pickRef={pickPhoto}
    />
  );
  const trouble = photoTrouble && !drawing && (
    <div className="photo-trouble" role="alert">
      <p>{photoTrouble}</p>
      <div className="photo-trouble-actions">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => pickPhoto.current?.()}>
          Choose another photo
        </button>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => draw({ withoutPhoto: true })}>
          Paint without the photo
          <CreditCost credits={cost.credits} />
        </button>
      </div>
    </div>
  );

  const confirm = async (replaceId?: string) => {
    if (!drafted || confirming) return;
    const finalName = name.trim() || drafted.name;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ character: { name: finalName, look: drafted.look, svg: drafted.svg, notes: notes.trim() || null, relationships: relationships.trim() || null, gender, prompt: prefilled.current || description.trim() }, replaceId }),
      });
      const data = (await res.json()) as { character?: SavedCharacter; error?: string; limitReached?: boolean };
      if (!res.ok || !data.character) {
        if (data.limitReached) {
          setReplacing(true);
          return;
        }
        throw new Error(data.error || "Couldn't save that character.");
      }
      onConfirmed(data.character);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create a character">
        <div className="modal-head">
          <h3>{replacing ? "Pick one to replace" : drafted ? "Here they are!" : "Dream up a character"}</h3>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {!drafted && !replacing && (
          <>
            <p className="meta">Say it out loud, or type it: &ldquo;a little purple giraffe with spotty socks&rdquo;.</p>
            <div className="field-row">
              <DictateButton onText={setDescription} label="Describe by voice" />
              <GrowingInput
                value={description}
                maxLength={200}
                placeholder="A sleepy hedgehog who loves pancakes…"
                onChange={setDescription}
                onEnter={() => draw()}
                aria-label="Describe your character"
              />
            </div>
            {photoField}
            {trouble}
            <div className="field-row">
              <button type="button" className="btn btn-primary btn-block" onClick={() => draw()} disabled={!description.trim() || drawing}>
                {drawing ? (
                  <>
                    <LeafLoader size={18} /> Painting…
                  </>
                ) : (
                  <>
                    <MapleMark />
                    Paint them
                    <CreditCost credits={cost.credits} />
                  </>
                )}
              </button>
            </div>
            {drawing && <CharacterProgressBar progress={progress} name={name} />}
          </>
        )}

        {drafted && !replacing && (
          <>
            {/* Who they are: picture, name, and male/female/open. */}
            <div className="drafted-hero">
              <span className={`drafted-portrait ${drawing ? "repainting" : ""}`}>
                <CharacterPortrait character={drafted} className="character-preview-portrait" />
              </span>
              <input className="input char-name-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Character name" />
              <GenderPicker value={gender} onChange={setGender} disabled={confirming} />
            </div>

            {/* What they were painted from - edit it and repaint. */}
            <label className="field-box">
              <span className="field-box-label">Description</span>
              <GrowingInput
                className="field-box-input"
                value={description}
                maxLength={200}
                onChange={setDescription}
                onEnter={() => draw()}
                aria-label="Description"
                disabled={drawing}
              />
              <span className="field-box-foot">
                <button type="button" className="btn btn-soft btn-sm" onClick={() => draw()} disabled={!description.trim() || drawing}>
                  {drawing ? (
                    <>
                      <LeafLoader size={14} /> Painting…
                    </>
                  ) : (
                    <>
                      Repaint
                      <CreditCost credits={cost.credits} />
                    </>
                  )}
                </button>
              </span>
            </label>

            {photoField}
            {trouble}
            {drawing && <CharacterProgressBar progress={progress} name={name} />}

            <CharacterNotesField value={notes} onChange={setNotes} name={name.trim() || drafted.name} disabled={confirming} />
            <CharacterRelationshipsField value={relationships} onChange={setRelationships} disabled={confirming} />

            <div className="redraw-actions">
              <button type="button" className="btn btn-ghost" onClick={close} disabled={confirming}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-block" onClick={() => confirm()} disabled={!name.trim() || confirming || drawing}>
                {confirming ? (
                  <>
                    <LeafLoader size={18} /> Saving…
                  </>
                ) : (
                  <>
                    <MapleMark />
                    Save
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {replacing && (
          <>
            <p className="meta">
              Your plan keeps {existing.length} characters. Pick one to replace with &ldquo;{name}&rdquo;.
            </p>
            <div className="grid chars">
              {existing.map((c) => (
                <button key={c.id} type="button" className="plate char-plate replace-plate" disabled={confirming} onClick={() => confirm(c.id)}>
                  <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} />
                  <span className="plate-label">{c.name}</span>
                  <span className="plate-sub">
                    {confirming ? (
                      <>
                        <LeafLoader size={16} /> Saving…
                      </>
                    ) : (
                      "Replace this one"
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="field-row">
              <button type="button" className="btn btn-ghost" onClick={() => setReplacing(false)} disabled={confirming}>
                Back
              </button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>
      {askStop && drawing && <StopPaintingConfirm name={drafted ? name : undefined} onStop={stopAndClose} onStay={() => setAskStop(false)} />}
    </div>
  );
}

/** The optional photo of who or what the character is. The box itself is
 *  the button: tap it to add a photo (a phone offers its camera or photo
 *  library); once added the photo fills the box, and tapping it opens a
 *  small menu to replace or remove it. The photo is made smaller and
 *  re-saved here before it's sent (dropping its location and camera
 *  details), and it's never kept. */
function PhotoField({
  photo,
  onChange,
  disabled,
  pickRef,
}: {
  photo: ChosenPhoto | null;
  onChange: (p: ChosenPhoto | null) => void;
  disabled?: boolean;
  /** Set to a function opening the photo picker (for "choose another"). */
  pickRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const pick = () => input.current?.click();
  if (pickRef) pickRef.current = pick;

  const got = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // (so the same photo can be picked again after removing it)
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      onChange(await preparePhoto(file));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That photo couldn't be used.");
    } finally {
      setBusy(false);
    }
  };

  // The menu sits on the page (the dialog scrolls, and would clip it),
  // just under the photo - or above it, if there's no room below.
  const openMenu = () => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom > 120;
    setMenuAt({ top: below ? r.bottom + 6 : r.top - 6, left: r.left + r.width / 2, width: r.width });
  };
  const open = menuAt !== null;
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || box.current?.contains(t)) return;
      setMenuAt(null);
      // (a tap outside only puts the menu away: it doesn't also close the
      // dialog behind it, or press whatever it landed on)
      const swallow = (c: Event) => {
        c.stopPropagation();
        c.preventDefault();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 600);
    };
    // (Escape closes the menu, not the whole dialog)
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setMenuAt(null);
      box.current?.focus();
    };
    const moved = () => setMenuAt(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", moved);
    window.addEventListener("scroll", moved, { capture: true, passive: true });
    menu.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", moved);
      window.removeEventListener("scroll", moved, { capture: true });
    };
  }, [open]);

  return (
    <div className="photo-field">
      <button
        ref={box}
        type="button"
        className={`photo-drop${photo ? " filled" : ""}${busy ? " busy" : ""}`}
        onClick={() => (photo ? (open ? setMenuAt(null) : openMenu()) : pick())}
        disabled={disabled || busy}
        aria-haspopup={photo ? "menu" : undefined}
        aria-expanded={photo ? open : undefined}
        aria-label={photo ? "The photo they'll be painted from - change or remove it" : "Add a photo of them (optional)"}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="" />
            <span className="photo-drop-tag">Photo added</span>
          </>
        ) : busy ? (
          <span className="photo-drop-empty">
            <LeafLoader size={28} />
            <span className="photo-drop-title">Getting the photo ready…</span>
          </span>
        ) : (
          <span className="photo-drop-empty">
            <svg className="photo-drop-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path d="M4 8.5a2 2 0 0 1 2-2h1.6l1.3-2h6.2l1.3 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="12.6" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="photo-drop-title">
              Add a photo of them <span className="field-box-optional">optional</span>
            </span>
            <span className="photo-drop-sub">We&apos;ll match their colours and look</span>
          </span>
        )}
      </button>
      <p className="photo-drop-note">{problem ? <span className="error">{problem}</span> : "Only used to paint them - never kept."}</p>
      <input ref={input} type="file" accept="image/*" hidden onChange={got} aria-label="Choose a photo" />
      {open &&
        createPortal(
          <div
            ref={menu}
            className="music-dropdown photo-menu"
            role="menu"
            aria-label="Photo"
            style={{ position: "fixed", top: menuAt.top, left: menuAt.left, right: "auto", transform: `translate(-50%, ${menuAt.top < (box.current?.getBoundingClientRect().top ?? 0) ? "-100%" : "0"})` }}
          >
            <button
              type="button"
              role="menuitem"
              className="music-dropdown-item"
              onClick={() => {
                setMenuAt(null);
                pick();
              }}
            >
              Replace photo
            </button>
            <button
              type="button"
              role="menuitem"
              className="music-dropdown-item"
              onClick={() => {
                setMenuAt(null);
                onChange(null);
              }}
            >
              Remove photo
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Optional freeform "about them" box: personality, and especially how
 *  they relate to other characters or people. Shared by the creator and
 *  the My characters edit popup. */
export function CharacterNotesField({
  value,
  onChange,
  name,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <label className="field-box">
      <span className="field-box-label">
        About {name || "them"} <span className="field-box-optional">optional</span>
      </span>
      <textarea
        className="field-box-input notes-input"
        value={value}
        maxLength={NOTES_MAX}
        disabled={disabled}
        rows={2}
        placeholder="Personality and favourite things - e.g. loves puddles, a little shy"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Optional box for their relationships, kept apart from "About": how
 *  they're related to the family and to other characters. The storyteller
 *  follows these exactly. Shared by the creator and the edit popup. */
export function CharacterRelationshipsField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field-box">
      <span className="field-box-label">
        Relationships <span className="field-box-optional">optional</span>
      </span>
      <textarea
        className="field-box-input notes-input"
        value={value}
        maxLength={NOTES_MAX}
        disabled={disabled}
        rows={2}
        placeholder="Who they are to your family and friends - e.g. Colin's big sister, Grandma's cat"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
