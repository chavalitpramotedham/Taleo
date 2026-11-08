"use client";
import { useEffect, useState } from "react";
import type { SavedCharacter } from "@/lib/types";
import { CharacterPortrait } from "@/components/art/Painting";
import { CharacterCreatorModal } from "@/components/CharacterCreatorModal";
import { LeafLoader } from "@/components/Icons";
import { MAX_CHARACTERS } from "@/lib/characters";

export function CharacterManager() {
  const [characters, setCharacters] = useState<SavedCharacter[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d: { characters?: SavedCharacter[] }) => setCharacters(d.characters ?? []))
      .catch(() => setCharacters([]));
  }, []);

  const rename = async (id: string) => {
    const newName = renaming[id]?.trim();
    const current = characters?.find((c) => c.id === id);
    if (!newName || !current || newName === current.name || busyId) return;
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = (await res.json()) as { character?: SavedCharacter; error?: string };
      if (!res.ok || !data.character) throw new Error(data.error || "Couldn't rename that character.");
      setCharacters((cur) => (cur ?? []).map((c) => (c.id === id ? data.character! : c)));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (busyId || !window.confirm("Delete this character? This can't be undone.")) return;
    setBusyId(id);
    setNotice(null);
    try {
      await fetch(`/api/characters/${id}`, { method: "DELETE" });
      setCharacters((cur) => (cur ?? []).filter((c) => c.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  if (characters === null) {
    return (
      <section className="panel">
        <h3>Your characters</h3>
        <LeafLoader size={32} />
      </section>
    );
  }

  return (
    <section className="panel">
      <h3>Your characters</h3>
      <p className="meta">
        Save up to {MAX_CHARACTERS} custom characters to reuse in any story. {characters.length}/{MAX_CHARACTERS} saved.
      </p>

      {characters.length > 0 && (
        <div className="saved-characters">
          {characters.map((c) => (
            <div key={c.id} className="saved-character">
              <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} className="saved-character-portrait" />
              <div className="saved-character-body">
                <div className="field-row">
                  <input
                    className="input"
                    value={renaming[c.id] ?? c.name}
                    maxLength={40}
                    onChange={(e) => setRenaming((cur) => ({ ...cur, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && rename(c.id)}
                    aria-label={`Rename ${c.name}`}
                  />
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => rename(c.id)}
                    disabled={busyId === c.id || !renaming[c.id] || renaming[c.id].trim() === c.name}
                  >
                    Rename
                  </button>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => remove(c.id)} disabled={busyId === c.id}>
                    {busyId === c.id ? <LeafLoader size={14} /> : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <p className="meta">{notice}</p>}

      <div className="field-row">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          Create a new character
        </button>
      </div>

      {creating && (
        <CharacterCreatorModal
          existing={characters}
          onClose={() => setCreating(false)}
          onConfirmed={(character) => {
            setCharacters((cur) => {
              const kept = (cur ?? []).filter((c) => c.id !== character.id);
              return [...kept, character];
            });
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}
