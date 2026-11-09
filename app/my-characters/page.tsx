"use client";
import { requestCharacter, type CharacterProgress } from "@/lib/character-client";
import { CharacterProgressBar } from "@/components/CharacterProgressBar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { SavedCharacter, CharacterGender } from "@/lib/types";
import { saveCharacterImage } from "@/lib/save-image";
import { GrowingInput } from "@/components/GrowingInput";
import { DictateButton } from "@/components/DictateButton";
import { MAX_CHARACTERS } from "@/lib/characters";
import { CharacterPortrait } from "@/components/art/Painting";
import { CharacterCreatorModal, CharacterNotesField, CharacterRelationshipsField } from "@/components/CharacterCreatorModal";
import { GenderPicker } from "@/components/GenderPicker";
import { DownloadIcon, LeafLoader, MapleMark } from "@/components/Icons";
import { PageLoading } from "@/components/PageLoading";

export default function MyCharactersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [characters, setCharacters] = useState<SavedCharacter[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SavedCharacter | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in?next=/my-characters");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d: { characters?: SavedCharacter[] }) => setCharacters(d.characters ?? []))
      .catch(() => setCharacters([]));
  }, [status]);

  if (status !== "authenticated" || characters === null) return <PageLoading label="Gathering your characters…" />;

  return (
    <div className="container">
      <header className="wizard-head">
        <p className="eyebrow">Just yours</p>
        <h1>My characters</h1>
        <p className="sub">
          {characters.length} of {MAX_CHARACTERS} slots used. Tap a character to edit or delete them.
        </p>
      </header>

      <div className="shelf">
        {Array.from({ length: MAX_CHARACTERS }, (_, i) => {
          const c = characters[i];
          if (!c) {
            return (
              <button key={`empty-${i}`} type="button" className="book-card char-card char-card-empty" onClick={() => setCreating(true)}>
                <span className="cover">
                  <span className="char-card-plus" aria-hidden>
                    +
                  </span>
                </span>
                <span className="body">
                  <span className="char-card-title">New character</span>
                  <span className="meta">Empty slot</span>
                </span>
              </button>
            );
          }
          return (
            <button key={c.id} type="button" className="book-card char-card" onClick={() => setEditing(c)}>
              <span className="cover">
                <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} className="cover-portrait" />
              </span>
              <span className="body">
                <span className="char-card-title">{c.name}</span>
                <span className="meta">Tap to edit</span>
              </span>
            </button>
          );
        })}
      </div>

      {creating && (
        <CharacterCreatorModal
          existing={characters}
          onClose={() => setCreating(false)}
          onConfirmed={(character) => {
            setCharacters((cur) => [...(cur ?? []).filter((c) => c.id !== character.id), character]);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <CharacterEditModal
          character={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCharacters((cur) => (cur ?? []).map((c) => (c.id === updated.id ? updated : c)));
            setEditing(null);
          }}
          onUpdated={(updated) => {
            setCharacters((cur) => (cur ?? []).map((c) => (c.id === updated.id ? updated : c)));
            setEditing(updated);
          }}
          onDeleted={(id) => {
            setCharacters((cur) => (cur ?? []).filter((c) => c.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CharacterEditModal({
  character,
  onClose,
  onSaved,
  onUpdated,
  onDeleted,
}: {
  character: SavedCharacter;
  onClose: () => void;
  onSaved: (c: SavedCharacter) => void;
  /** Saved without closing (e.g. a new look accepted). */
  onUpdated: (c: SavedCharacter) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(character.name);
  const [notes, setNotes] = useState(character.notes ?? "");
  const [relationships, setRelationships] = useState(character.relationships ?? "");
  const [gender, setGender] = useState<CharacterGender | null>(character.gender ?? null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const nameChanged = name.trim() !== character.name;
  const notesChanged = notes.trim() !== (character.notes ?? "");
  const relationshipsChanged = relationships.trim() !== (character.relationships ?? "");
  const genderChanged = gender !== (character.gender ?? null);
  const canSave = Boolean(name.trim()) && (nameChanged || notesChanged || relationshipsChanged || genderChanged) && !busy;
  const [error, setError] = useState<string | null>(null);

  // The picture: tap it to save it or redraw it. A redraw keeps the name,
  // notes and the current look as the starting point; the new picture is
  // shown beside the old one to keep or discard.
  const [stage, setStage] = useState<"idle" | "menu" | "redraw" | "drawing" | "compare">("idle");
  const [change, setChange] = useState("");
  const [redrawn, setRedrawn] = useState<{ look: string; svg: string | null } | null>(null);
  const [progress, setProgress] = useState<CharacterProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveImage = async () => {
    if (!character.svg || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveCharacterImage(character.svg, character.name);
    } catch {
      setError("Couldn't save the picture. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const redraw = async () => {
    if (!change.trim() || stage === "drawing") return;
    setStage("drawing");
    setProgress(null);
    setError(null);
    try {
      const data = await requestCharacter(
        { description: change.trim(), name: character.name, current: { look: character.look, notes: character.notes, relationships: character.relationships ?? null, gender: character.gender } },
        setProgress,
      );
      if (!data.character.svg) throw new Error("Couldn't paint that one. Try again?");
      setRedrawn({ look: data.character.look, svg: data.character.svg });
      setStage("compare");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("redraw");
    }
  };
  const acceptRedraw = async () => {
    if (!redrawn || busy) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        // the redraw request becomes their last-used prompt (notes untouched)
        body: JSON.stringify({ look: redrawn.look, svg: redrawn.svg, prompt: change.trim() }),
      });
      const data = (await res.json()) as { character?: SavedCharacter; error?: string };
      if (!res.ok || !data.character) throw new Error(data.error || "Couldn't save the new look.");
      setBusy(null);
      setRedrawn(null);
      setChange("");
      setStage("idle");
      onUpdated(data.character);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!canSave) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(nameChanged ? { name: name.trim() } : {}), ...(notesChanged ? { notes: notes.trim() || null } : {}), ...(relationshipsChanged ? { relationships: relationships.trim() || null } : {}), ...(genderChanged ? { gender } : {}) }),
      });
      const data = (await res.json()) as { character?: SavedCharacter; error?: string };
      if (!res.ok || !data.character) throw new Error(data.error || "Couldn't save those changes.");
      onSaved(data.character);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't delete that character.");
      onDeleted(character.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  const redrawing = stage === "redraw" || stage === "drawing" || stage === "compare";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Edit ${character.name}`}>
        <div className="modal-head">
          <h3>{character.name}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <button
          type="button"
          className={`char-edit-picture ${stage === "menu" ? "open" : ""}`}
          onClick={() => setStage((s) => (s === "menu" ? "idle" : "menu"))}
          aria-expanded={stage === "menu"}
          aria-label={`${character.name}'s picture - save it or redraw it`}
        >
          <CharacterPortrait character={{ preset: null, svg: character.svg, name: character.name }} className="char-edit-portrait" />
        </button>
        {stage === "menu" && (
          <div className="char-picture-actions">
            <button type="button" className="btn btn-primary char-save-btn" onClick={() => void saveImage()} disabled={saving} aria-label="Save image" title="Save image">
              {saving ? <LeafLoader size={18} /> : <DownloadIcon />}
            </button>
            <button
              type="button"
              className="btn btn-soft btn-sm char-redraw-btn"
              onClick={() => {
                // start from the prompt they were last painted from, to edit
                setChange(character.prompt ?? "");
                setStage("redraw");
              }}
            >
              Redraw look
            </button>
          </div>
        )}
        <input
          className="input char-name-input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          aria-label="Character name"
        />
        <GenderPicker value={gender} onChange={setGender} disabled={Boolean(busy)} />
        <CharacterNotesField value={notes} onChange={setNotes} name={name.trim() || character.name} disabled={Boolean(busy)} />
        <CharacterRelationshipsField value={relationships} onChange={setRelationships} disabled={Boolean(busy)} />
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>
          {busy === "save" && !redrawing ? (
            <>
              <LeafLoader size={18} /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
        <button type="button" className="btn btn-soft btn-block" onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)}>
          Delete character
        </button>
        {error && !redrawing && !confirmDelete && <p className="error">{error}</p>}
      </div>

      {confirmDelete && (
        // Deleting is final: its own popup, with a clear warning, before
        // anything happens.
        <div className="modal-backdrop redraw-backdrop" onClick={(e) => (e.stopPropagation(), busy !== "delete" && setConfirmDelete(false))}>
          <div className="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title" onClick={(e) => e.stopPropagation()}>
            <CharacterPortrait character={{ preset: null, svg: character.svg, name: character.name }} className="confirm-portrait" />
            <h3 id="confirm-delete-title">Delete {character.name}?</h3>
            <p className="confirm-warning">
              This can&apos;t be undone. {character.name} will be gone for good - their picture, name and notes - and won&apos;t be
              available for new stories. Stories they&apos;re already in stay as they are.
            </p>
            <div className="redraw-choices">
              <button type="button" className="btn btn-danger btn-block" onClick={() => void remove()} disabled={busy === "delete"}>
                {busy === "delete" ? (
                  <>
                    <LeafLoader size={18} /> Deleting…
                  </>
                ) : (
                  `Yes, delete ${character.name}`
                )}
              </button>
              <button type="button" className="btn btn-soft btn-block" onClick={() => setConfirmDelete(false)} disabled={busy === "delete"}>
                Keep {character.name}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
      {redrawing && (
        // The whole redraw in its own popup over the editor: say what should
        // change, watch it paint, then keep the new look or the old one.
        <div className="modal-backdrop redraw-backdrop" onClick={(e) => e.stopPropagation()}>
          <div className="modal-panel redraw-panel" role="dialog" aria-modal="true" aria-label={`Redraw ${character.name}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{stage === "compare" ? `${character.name}'s new look` : `Redraw ${character.name}`}</h3>
              {stage !== "drawing" && busy !== "save" && (
                <button type="button" className="icon-btn" onClick={() => setStage("idle")} aria-label="Close">
                  ✕
                </button>
              )}
            </div>
            {stage === "compare" && redrawn ? (
              <>
                <div className="redraw-compare">
                  <figure>
                    <CharacterPortrait character={{ preset: null, svg: character.svg, name: character.name }} className="char-edit-portrait" />
                    <figcaption>Before</figcaption>
                  </figure>
                  <figure className="redraw-new">
                    <CharacterPortrait character={{ preset: null, svg: redrawn.svg, name: character.name }} className="char-edit-portrait" />
                    <figcaption>New look</figcaption>
                  </figure>
                </div>
                <p className="meta redraw-note">The new look is used in every story from now on.</p>
                <div className="redraw-choices">
                  <button type="button" className="btn btn-primary btn-block" onClick={() => void acceptRedraw()} disabled={busy === "save"}>
                    {busy === "save" ? (
                      <>
                        <LeafLoader size={18} /> Saving…
                      </>
                    ) : (
                      <>
                        <MapleMark />
                        Keep the new look
                      </>
                    )}
                  </button>
                  <button type="button" className="btn btn-soft btn-block" onClick={() => setStage("idle")} disabled={busy === "save"}>
                    Keep the old one
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`char-edit-picture redraw-current ${stage === "drawing" ? "repainting" : ""}`}>
                  <CharacterPortrait character={{ preset: null, svg: character.svg, name: character.name }} className="char-edit-portrait" />
                </div>
                <p className="meta">
                  {character.prompt
                    ? `This is what ${character.name} was last painted from - edit it, then redraw. They keep their name and who they are.`
                    : `Describe how ${character.name} should look. They keep their name and who they are.`}
                </p>
                <div className="field-row">
                  <DictateButton onText={setChange} label="Describe by voice" />
                  <GrowingInput
                    value={change}
                    maxLength={200}
                    placeholder="A little rabbit with a red scarf and floppy ears…"
                    onChange={setChange}
                    onEnter={() => void redraw()}
                    aria-label="What should change"
                    disabled={stage === "drawing"}
                  />
                </div>
                <button type="button" className="btn btn-primary btn-block" onClick={() => void redraw()} disabled={!change.trim() || stage === "drawing"}>
                  {stage === "drawing" ? (
                    <>
                      <LeafLoader size={18} /> Painting…
                    </>
                  ) : (
                    <>
                      <MapleMark />
                      Redraw
                    </>
                  )}
                </button>
                {stage === "drawing" && <CharacterProgressBar progress={progress} name={character.name} />}
              </>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
