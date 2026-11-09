"use client";
import { useEffect, useRef, useState } from "react";
import type { CharacterDef, CharacterGender, CharacterResponse, SavedCharacter } from "@/lib/types";
import { GenderPicker } from "@/components/GenderPicker";
import { CharacterPortrait } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { GrowingInput } from "@/components/GrowingInput";
import { LeafLoader, MapleMark } from "@/components/Icons";
import { MAX_CHARACTERS, NOTES_MAX } from "@/lib/characters";

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
  const prefilled = useRef("");
  const [gender, setGender] = useState<CharacterGender | null>(null);
  const [drafted, setDrafted] = useState<CharacterDef | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const draw = async () => {
    if (!description.trim() || drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, name: name.trim() || undefined }),
      });
      const data = (await res.json()) as CharacterResponse & { error?: string };
      if (!res.ok || !data.character) throw new Error(data.error || "Couldn't paint that one. Try again?");
      setDrafted(data.character);
      setName(data.character.name);
      // The description they painted from starts off their "About" notes
      // (the storyteller reads these), ready to add relationships and the
      // like. A repaint updates it - unless they've written their own.
      const used = description.trim().slice(0, NOTES_MAX);
      const before = prefilled.current;
      prefilled.current = used;
      setNotes((cur) => (!cur.trim() || cur === before ? used : cur));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setDrawing(false);
    }
  };

  const confirm = async (replaceId?: string) => {
    if (!drafted || confirming) return;
    const finalName = name.trim() || drafted.name;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ character: { name: finalName, look: drafted.look, svg: drafted.svg, notes: notes.trim() || null, gender, prompt: prefilled.current || description.trim() }, replaceId }),
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create a character">
        <div className="modal-head">
          <h3>{replacing ? "Pick one to replace" : drafted ? "Here they are!" : "Dream up a character"}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
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
                onEnter={draw}
                aria-label="Describe your character"
              />
            </div>
            <div className="field-row">
              <button type="button" className="btn btn-primary btn-block" onClick={draw} disabled={!description.trim() || drawing}>
                {drawing ? (
                  <>
                    <LeafLoader size={18} /> Painting…
                  </>
                ) : (
                  <>
                    <MapleMark />
                    Paint them
                  </>
                )}
              </button>
            </div>
            {drawing && <p className="meta character-wait">Painting them with extra care - this can take a minute or two.</p>}
          </>
        )}

        {drafted && !replacing && (
          <>
            <div className="character-preview">
              <CharacterPortrait character={drafted} className="character-preview-portrait" />
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Character name" />
            </div>
            <GenderPicker value={gender} onChange={setGender} disabled={confirming} />
            <p className="meta">
              {drawing ? "Painting them again with extra care - this can take a minute or two." : "Not quite right? Edit the description and paint them again."}
            </p>
            <div className="field-row">
              <GrowingInput
                value={description}
                maxLength={200}
                onChange={setDescription}
                onEnter={draw}
                aria-label="Describe your character"
              />
              <button type="button" className="btn btn-soft" onClick={draw} disabled={!description.trim() || drawing}>
                {drawing ? (
                  <>
                    <LeafLoader size={16} /> Painting…
                  </>
                ) : (
                  "Regenerate"
                )}
              </button>
            </div>
            <CharacterNotesField value={notes} onChange={setNotes} name={name.trim() || drafted.name} disabled={confirming} />
            <div className="field-row">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={confirming}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-block" onClick={() => confirm()} disabled={!name.trim() || confirming}>
                {confirming ? (
                  <>
                    <LeafLoader size={18} /> Saving…
                  </>
                ) : (
                  <>
                    <MapleMark />
                    Confirm &amp; save
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {replacing && (
          <>
            <p className="meta">
              You&apos;ve saved {MAX_CHARACTERS} characters already. Pick one to replace with &ldquo;{name}&rdquo;.
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
    <label className="notes-field">
      <span className="notes-label">
        About {name || "them"} <span className="meta">(optional)</span>
      </span>
      <textarea
        className="input comment-input notes-input"
        value={value}
        maxLength={NOTES_MAX}
        disabled={disabled}
        placeholder="Anything that matters: who they are, what they love, and how they know the others (e.g. Pip's big sister, always looks out for him)."
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
