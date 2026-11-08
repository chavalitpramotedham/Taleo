"use client";
import { useEffect, useState } from "react";
import type { SavedCharacter } from "@/lib/types";
import { CharacterPortrait } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { LeafLoader } from "@/components/Icons";
import { MAX_CHARACTERS } from "@/lib/characters";

type Pending = { description: string; name: string } | null;

export function CharacterManager() {
  const [characters, setCharacters] = useState<SavedCharacter[] | null>(null);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d: { characters?: SavedCharacter[] }) => setCharacters(d.characters ?? []))
      .catch(() => setCharacters([]));
  }, []);

  const createOrReplace = async (replaceId?: string) => {
    const desc = (replaceId ? pending?.description : description)?.trim();
    const nm = (replaceId ? pending?.name : name)?.trim();
    if (!desc || drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: desc, name: nm || undefined, replaceId }),
      });
      const data = (await res.json()) as { character?: SavedCharacter; error?: string; limitReached?: boolean };
      if (!res.ok || !data.character) {
        if (data.limitReached) {
          setPending({ description: desc, name: nm || "" });
          return;
        }
        throw new Error(data.error || "Couldn't paint that one. Try again?");
      }
      setCharacters((cur) => {
        const kept = (cur ?? []).filter((c) => c.id !== data.character!.id);
        return [...kept, data.character!];
      });
      setPending(null);
      setDescription("");
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setDrawing(false);
    }
  };

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
                    {busyId === c.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <p className="meta">{notice}</p>}

      {pending ? (
        <div className="panel panel-invent">
          <p className="meta">
            You&apos;ve saved {MAX_CHARACTERS} already. Pick one to replace with &ldquo;{pending.name || pending.description}&rdquo;, or cancel.
          </p>
          <div className="grid chars">
            {characters.map((c) => (
              <button key={c.id} type="button" className="plate char-plate replace-plate" disabled={drawing} onClick={() => createOrReplace(c.id)}>
                <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} />
                <span className="plate-label">{c.name}</span>
                <span className="plate-sub">{drawing ? <LeafLoader size={16} /> : "Replace this one"}</span>
              </button>
            ))}
          </div>
          <div className="field-row">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)} disabled={drawing}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="panel panel-invent">
          <h3>Create a new character</h3>
          <p className="meta">Say it out loud, or type it: &ldquo;a little purple giraffe with spotty socks&rdquo;.</p>
          <div className="field-row">
            <DictateButton onText={setDescription} label="Describe by voice" />
            <input
              className="input"
              value={description}
              maxLength={200}
              placeholder="A sleepy hedgehog who loves pancakes…"
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Describe your character"
            />
          </div>
          <div className="field-row">
            <input
              className="input"
              value={name}
              maxLength={40}
              placeholder="Give them a name (optional)"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createOrReplace()}
              aria-label="Character name"
            />
            <button type="button" className="btn btn-primary" onClick={() => createOrReplace()} disabled={!description.trim() || drawing}>
              {drawing ? <LeafLoader size={18} /> : "Paint & save"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
