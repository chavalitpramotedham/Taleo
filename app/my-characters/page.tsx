"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { SavedCharacter } from "@/lib/types";
import { MAX_CHARACTERS } from "@/lib/characters";
import { CharacterPortrait } from "@/components/art/Painting";
import { CharacterCreatorModal, CharacterNotesField } from "@/components/CharacterCreatorModal";
import { LeafLoader } from "@/components/Icons";

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

  if (status !== "authenticated" || characters === null) return null;

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
  onDeleted,
}: {
  character: SavedCharacter;
  onClose: () => void;
  onSaved: (c: SavedCharacter) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(character.name);
  const [notes, setNotes] = useState(character.notes ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const nameChanged = name.trim() !== character.name;
  const notesChanged = notes.trim() !== (character.notes ?? "");
  const canSave = Boolean(name.trim()) && (nameChanged || notesChanged) && !busy;
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ ...(nameChanged ? { name: name.trim() } : {}), ...(notesChanged ? { notes: notes.trim() || null } : {}) }),
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
    if (busy || !window.confirm(`Delete ${character.name}? This can't be undone.`)) return;
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Edit ${character.name}`}>
        <div className="modal-head">
          <h3>{character.name}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <CharacterPortrait character={{ preset: null, svg: character.svg, name: character.name }} className="char-edit-portrait" />
        <input
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          aria-label="Character name"
        />
        <CharacterNotesField value={notes} onChange={setNotes} name={name.trim() || character.name} disabled={Boolean(busy)} />
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={!canSave}>
          {busy === "save" ? (
            <>
              <LeafLoader size={18} /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
        <button type="button" className="btn btn-soft btn-block" onClick={remove} disabled={Boolean(busy)}>
          {busy === "delete" ? (
            <>
              <LeafLoader size={18} /> Deleting…
            </>
          ) : (
            "Delete character"
          )}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
