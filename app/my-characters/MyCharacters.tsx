"use client";
import { MakeLabel, useMakingCost } from "@/components/CreditCost";
import { PaintingCancelled, requestCharacter, type CharacterProgress } from "@/lib/character-client";
import { StopPaintingConfirm, useLeaveWarning } from "@/components/StopPaintingConfirm";
import { CharacterProgressBar } from "@/components/CharacterProgressBar";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { recall, remember } from "@/lib/remember";
import type { SavedCharacter, CharacterGender } from "@/lib/types";
import { saveCharacterImage } from "@/lib/save-image";
import { GrowingInput } from "@/components/GrowingInput";
import { DictateButton } from "@/components/DictateButton";
import { useCharacterLimit } from "@/lib/useCharacterLimit";
import { CharacterPortrait } from "@/components/art/Painting";
import { CharacterCreatorModal, CharacterNotesField, CharacterRelationshipsField, PhotoField, photoToSend, type ChosenPhoto } from "@/components/CharacterCreatorModal";
import { PhotoProblem } from "@/lib/character-photo";
import { GenderPicker } from "@/components/GenderPicker";
import { DownloadIcon, LeafLoader, MapleMark } from "@/components/Icons";
import { PageLoading } from "@/components/PageLoading";

/** The roster, given by the page (`initial`, already read on the server);
 *  null if the server couldn't read it, and it's asked for here. */
export function MyCharacters({ initial, initialLimit }: { initial: SavedCharacter[] | null; initialLimit: number | null }) {
  const { status } = useSession();
  const router = useRouter();
  const [characters, setCharacters] = useState<SavedCharacter[] | null>(() => initial ?? recall<SavedCharacter[]>("characters") ?? null);
  useEffect(() => {
    if (characters) remember("characters", characters);
  }, [characters]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SavedCharacter | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in?next=/my-characters");
  }, [status, router]);

  useEffect(() => {
    // (already here from the page: no need to ask again)
    if (status !== "authenticated" || initial) return;
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d: { characters?: SavedCharacter[] }) => setCharacters(d.characters ?? []))
      .catch(() => setCharacters((cur) => cur ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // (the page's answer until the app knows who's signed in)
  const liveLimit = useCharacterLimit();
  const limit = status === "authenticated" ? liveLimit : (initialLimit ?? Infinity);

  // Rearranging: a draft order while arranging, saved in one go on Done.
  const [arranging, setArranging] = useState<SavedCharacter[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const startArranging = () => {
    setOrderError(null);
    setArranging(characters ?? []);
  };
  const finishArranging = async () => {
    if (!arranging || !characters || savingOrder) return;
    if (arranging.every((c, i) => c.id === characters[i]?.id)) return setArranging(null); // nothing moved
    setSavingOrder(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: arranging.map((c) => c.id) }),
      });
      const data = (await res.json().catch(() => ({}))) as { characters?: SavedCharacter[]; error?: string };
      if (!res.ok || !data.characters) throw new Error(data.error || "Couldn't save the new order. Please try again.");
      setCharacters(data.characters);
      setArranging(null);
    } catch (e) {
      setOrderError(e instanceof TypeError ? "No connection - check your internet and try again." : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSavingOrder(false);
    }
  };

  if (characters === null) return <PageLoading label="Gathering your characters…" />;

  return (
    <div className="container chars-page">
      <header className="wizard-head">
        <p className="eyebrow">Just yours</p>
        <h1>My characters</h1>
        <p className="sub">
          {characters.length === 0
            ? `Add your child, a sibling or a favourite toy, and they can star in any story you make.${Number.isFinite(limit) ? ` You have room for ${limit}.` : ""}`
            : Number.isFinite(limit)
            ? `${Math.min(characters.length, limit)} of ${limit} slots used.`
            : `${characters.length} ${characters.length === 1 ? "character" : "characters"} - unlimited on your account.`}{" "}
          {characters.length ? (arranging ? "" : "Tap a character to edit or delete them.") : ""}
        </p>
        {characters.length > 1 && !arranging && (
          <button type="button" className="btn btn-soft btn-sm char-arrange-btn char-inline-only" onClick={startArranging}>
            <ArrangeIcon />
            Rearrange
          </button>
        )}
      </header>

      {arranging ? (
        <>
          <div className="char-arrange-bar" role="region" aria-label="Rearranging characters">
            <p className="meta">Drag them into the order you like, or use the arrows. Stories you make will show them in this order too.</p>
            <div className="char-arrange-actions char-inline-only">
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setArranging(null)} disabled={savingOrder}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void finishArranging()} disabled={savingOrder}>
                {savingOrder ? (
                  <>
                    <LeafLoader size={16} /> Saving…
                  </>
                ) : (
                  "Done"
                )}
              </button>
            </div>
            {orderError && <p className="error">{orderError}</p>}
          </div>
          <ArrangeShelf list={arranging} onChange={setArranging} disabled={savingOrder} />
          {/* (again under the cards, where the top ones have scrolled away;
              phones and tablets have the floating bar instead) */}
          {arranging.length > 2 && (
            <div className="char-arrange-actions char-arrange-actions-foot char-inline-only">
              <button type="button" className="btn btn-soft" onClick={() => setArranging(null)} disabled={savingOrder}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void finishArranging()} disabled={savingOrder}>
                {savingOrder ? "Saving…" : "Done"}
              </button>
            </div>
          )}
        </>
      ) : (
      <div className="shelf">
        {Array.from({ length: Number.isFinite(limit) ? Math.max(limit, characters.length) : characters.length + 1 }, (_, i) => {
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
      )}

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

      {/* Phones and tablets: Rearrange, then Cancel and Done, float at the
          foot of the screen, so there's no scrolling back up (or down) to
          find them. Rearrange is a quiet button; Done is the main one. */}
      {characters.length > 1 && (
        <div className="floating-cta touch-only char-float" role={arranging ? "region" : undefined} aria-label={arranging ? "Rearranging characters" : undefined}>
          {arranging ? (
            <>
              {orderError && <p className="error char-float-error">{orderError}</p>}
              <div className="char-float-row">
                <button type="button" className="btn btn-soft" onClick={() => setArranging(null)} disabled={savingOrder}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary char-float-done" onClick={() => void finishArranging()} disabled={savingOrder}>
                  {savingOrder ? (
                    <>
                      <LeafLoader size={16} /> Saving…
                    </>
                  ) : (
                    "Done"
                  )}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn-soft char-float-arrange" onClick={startArranging}>
              <ArrangeIcon />
              Rearrange
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The roster while rearranging: drag a card (finger or mouse) over
 *  another to swap places as you go, or use its arrows to move it one
 *  place at a time. Nothing is saved until Done. */
function ArrangeShelf({ list, onChange, disabled }: { list: SavedCharacter[]; onChange: (l: SavedCharacter[]) => void; disabled: boolean }) {
  const els = useRef(new Map<string, HTMLElement>());
  // the card being dragged: where the pointer and the card started (page
  // coordinates, so scrolling mid-drag doesn't throw it off) and where the
  // pointer is now
  const drag = useRef<{ id: string; pointer: number; sx: number; sy: number; ox: number; oy: number; px: number; py: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef(list);
  listRef.current = list;

  // Keep the dragged card under the finger, even as the others reflow
  // around it (its place in the grid changes; where it's drawn doesn't).
  const place = () => {
    const d = drag.current;
    const el = d && els.current.get(d.id);
    if (!d || !el) return;
    el.style.transform = `translate(${d.ox + d.px - d.sx - el.offsetLeft}px, ${d.oy + d.py - d.sy - el.offsetTop}px) scale(1.05) rotate(-1.5deg)`;
  };
  useLayoutEffect(place);

  const move = (id: string, to: number) => {
    const cur = listRef.current;
    const from = cur.findIndex((c) => c.id === id);
    if (from < 0 || to < 0 || to >= cur.length || from === to) return;
    const next = [...cur];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };

  const onDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (disabled || e.button > 0 || (e.target as Element).closest("button")) return;
    const el = els.current.get(id);
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, pointer: e.pointerId, sx: e.pageX, sy: e.pageY, ox: el.offsetLeft, oy: el.offsetTop, px: e.pageX, py: e.pageY };
    setDragId(id);
  };
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    // a little nudge of the page when dragging near the top or bottom
    const edge = 70;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
    d.px = e.pageX;
    d.py = e.pageY;
    place();
    for (const [id, el] of els.current) {
      if (id === d.id) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        move(d.id, listRef.current.findIndex((c) => c.id === id));
        break;
      }
    }
  };
  const onUp = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    const el = els.current.get(d.id);
    drag.current = null;
    if (el) el.style.transform = "";
    setDragId(null);
  };

  return (
    <ol className="shelf char-arrange-shelf" aria-label="Your characters, in order">
      {list.map((c, i) => (
        <li
          key={c.id}
          ref={(el) => {
            if (el) els.current.set(c.id, el);
            else els.current.delete(c.id);
          }}
          className={`book-card char-card char-card-arranging${dragId === c.id ? " dragging" : ""}`}
          onPointerDown={(e) => onDown(e, c.id)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={`${c.name}, ${i + 1} of ${list.length}`}
        >
          <span className="cover">
            <span className="char-arrange-num" aria-hidden>
              {i + 1}
            </span>
            <span className="char-arrange-grip" aria-hidden>
              <GripIcon />
            </span>
            <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} className="cover-portrait" />
          </span>
          <span className="body">
            <span className="char-card-title">{c.name}</span>
            <span className="char-arrange-moves">
              <button type="button" className="icon-btn" onClick={() => move(c.id, i - 1)} disabled={disabled || i === 0} aria-label={`Move ${c.name} earlier`}>
                ‹
              </button>
              <button type="button" className="icon-btn" onClick={() => move(c.id, i + 1)} disabled={disabled || i === list.length - 1} aria-label={`Move ${c.name} later`}>
                ›
              </button>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 12 18" width="10" height="15" aria-hidden>
      {[3, 9].flatMap((x) => [3, 9, 15].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
    </svg>
  );
}

function ArrangeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />
    </svg>
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
  // An optional photo to redraw them from (kept only in this popup, sent
  // only with the painting request), and what was wrong with it, if anything.
  const [photo, setPhoto] = useState<ChosenPhoto | null>(null);
  const [photoTrouble, setPhotoTrouble] = useState<string | null>(null);
  const pickPhoto = useRef<(() => void) | null>(null);
  const markPhotoRef = useRef<(() => void) | null>(null);
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
  // (what a redraw costs in credits, if anything)
  const cost = useMakingCost("character");
  const redraw = async (opts: { withoutPhoto?: boolean } = {}) => {
    if (!change.trim() || stage === "drawing") return;
    const sending = opts.withoutPhoto ? null : photo;
    if (opts.withoutPhoto) setPhoto(null);
    setStage("drawing");
    setProgress(null);
    setError(null);
    setPhotoTrouble(null);
    const mine = (painting.current = new AbortController());
    try {
      const data = await requestCharacter(
        { description: change.trim(), name: character.name, current: { look: character.look, notes: character.notes, relationships: character.relationships ?? null, gender: character.gender }, photo: photoToSend(sending) },
        setProgress,
        { signal: mine.signal },
      );
      if (!data.character.svg) throw new Error("Couldn't paint that one. Try again?");
      setRedrawn({ look: data.character.look, svg: data.character.svg });
      setStage("compare");
    } catch (e) {
      if (e instanceof PaintingCancelled) return; // stopped on purpose
      if (e instanceof PhotoProblem) setPhotoTrouble(e.message);
      else setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("redraw");
    } finally {
      cost.again(); // (the free one may just have been used)
      if (painting.current === mine) painting.current = null;
    }
  };
  // Leaving while the new look is being painted asks first: stopping
  // throws the painting away, staying lets it finish.
  const painting = useRef<AbortController | null>(null);
  const [askStop, setAskStop] = useState(false);
  const stopPainting = () => {
    painting.current?.abort();
    setAskStop(false);
    setStage("idle");
  };
  useLeaveWarning(stage === "drawing");
  useEffect(() => () => painting.current?.abort(), []);
  useEffect(() => {
    if (stage !== "drawing") setAskStop(false);
  }, [stage]);
  const drawingRef = useRef(false);
  drawingRef.current = stage === "drawing";
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
      setPhoto(null);
      setStage("idle");
      onUpdated(data.character);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // (mid-painting, Escape asks; over the question it means "keep painting")
      if (drawingRef.current) setAskStop((asking) => !asking);
      else onClose();
    };
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
              {busy !== "save" && (
                <button type="button" className="icon-btn" onClick={() => (stage === "drawing" ? setAskStop(true) : setStage("idle"))} aria-label="Close">
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
                <PhotoField
                  photo={photo}
                  onChange={(p) => {
                    setPhoto(p);
                    setPhotoTrouble(null);
                  }}
                  disabled={stage === "drawing"}
                  pickRef={pickPhoto}
                  markRef={markPhotoRef}
                />
                {photoTrouble && stage !== "drawing" && (
                  <div className="photo-trouble" role="alert">
                    <p>{photoTrouble}</p>
                    <div className="photo-trouble-actions">
                      {photo && !photo.marked && (
                        <button type="button" className="btn btn-soft btn-sm" onClick={() => markPhotoRef.current?.()}>
                          Circle who you mean
                        </button>
                      )}
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => pickPhoto.current?.()}>
                        Choose another photo
                      </button>
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => void redraw({ withoutPhoto: true })}>
                        Redraw without the photo
                      </button>
                    </div>
                  </div>
                )}
                <button type="button" className="btn btn-primary btn-block" onClick={() => void redraw()} disabled={!change.trim() || stage === "drawing"}>
                  {stage === "drawing" ? (
                    <>
                      <LeafLoader size={18} /> Painting…
                    </>
                  ) : (
                    <MakeLabel icon={<MapleMark />} credits={cost.credits} free={cost.free}>
                      Redraw
                    </MakeLabel>
                  )}
                </button>
                {stage === "drawing" && <CharacterProgressBar progress={progress} name={character.name} />}
              </>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
      {askStop && stage === "drawing" && <StopPaintingConfirm name={character.name} onStop={stopPainting} onStay={() => setAskStop(false)} />}
    </div>
  );
}
