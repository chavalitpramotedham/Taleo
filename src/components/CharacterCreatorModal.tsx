"use client";
import { useEffect, useRef, useState } from "react";
import type { CharacterDef, CharacterGender, SavedCharacter } from "@/lib/types";
import { GenderPicker } from "@/components/GenderPicker";
import { CharacterPortrait } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { GrowingInput } from "@/components/GrowingInput";
import { LeafLoader, MapleMark } from "@/components/Icons";
import { MAX_CHARACTERS, NOTES_MAX } from "@/lib/characters";
import { requestCharacter, type CharacterProgress } from "@/lib/character-client";
import { CharacterProgressBar } from "@/components/CharacterProgressBar";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const draw = async () => {
    if (!description.trim() || drawing) return;
    setDrawing(true);
    setProgress(null);
    setError(null);
    try {
      const data = await requestCharacter({ description, name: name.trim() || undefined }, setProgress);
      setDrafted(data.character);
      setName(data.character.name);
      // The description they were painted from is kept as their prompt
      // (shown in its own box); "About" is left for extra details.
      prefilled.current = description.trim();
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
                onEnter={draw}
                aria-label="Description"
                disabled={drawing}
              />
              <span className="field-box-foot">
                <button type="button" className="btn btn-soft btn-sm" onClick={draw} disabled={!description.trim() || drawing}>
                  {drawing ? (
                    <>
                      <LeafLoader size={14} /> Painting…
                    </>
                  ) : (
                    "Repaint"
                  )}
                </button>
              </span>
            </label>

            {drawing && <CharacterProgressBar progress={progress} name={name} />}

            <CharacterNotesField value={notes} onChange={setNotes} name={name.trim() || drafted.name} disabled={confirming} />
            <CharacterRelationshipsField value={relationships} onChange={setRelationships} disabled={confirming} />

            <div className="redraw-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={confirming}>
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
              On the Free plan you can keep {MAX_CHARACTERS} characters. Pick one to replace with &ldquo;{name}&rdquo;.
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
