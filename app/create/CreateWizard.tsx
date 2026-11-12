"use client";
import { DiscardCreditsNote } from "@/components/DiscardCreditsNote";
import { deviceHeader } from "@/lib/device";
import { MakeLabel, useMakingCost } from "@/components/CreditCost";
import { useEscape } from "@/lib/useEscape";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { recall, remember } from "@/lib/remember";
import { AGES, MAX_MINUTES, MIN_MINUTES, STANDARD_LENGTH, STORY_LENGTHS, aLength, lengthOf, timeWords, type AgeId } from "@/lib/ages";
import { PRESETS, THEMES, presetCharacter } from "@/lib/presets";
import type { CharacterDef, SavedCharacter, Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { CharacterPortrait, Painting } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { SideScroll } from "@/components/SideScroll";
import { Segmented } from "@/components/Segmented";
import { BedtimeHint } from "@/components/BedtimeHint";
import { useNightMode } from "@/components/NightMode";
import { GrowingInput } from "@/components/GrowingInput";
import { CharacterCreatorModal } from "@/components/CharacterCreatorModal";
import { useCharacterLimit } from "@/lib/useCharacterLimit";
import { PageLoading } from "@/components/PageLoading";
import { CreditIcon, LeafLoader, MapleMark } from "@/components/Icons";
import { LimitDialog, type LimitNotice } from "@/components/LimitDialog";
import { coverOf, titleOf } from "@/components/OngoingStory";
import { useOngoingStory } from "@/lib/ongoing";
import { forgetIdea, takeHandover } from "@/lib/ideas";

const AGE_KEY = "taleo.age";
const MINUTES_KEY = "taleo.minutes";
const MAX_CENTRAL = 3;
type Step = 0 | 1 | 2;
const GROUPS = [
  { key: "all", label: "All" },
  { key: "animal", label: "Animals" },
  { key: "food", label: "Foodies" },
  { key: "object", label: "Curiosities" },
] as const;
const STEP_TITLES = ["Who is the story for?", "Who shall it be about?", "What shall happen?"];
const STEP_NOTES = [
  "The words, the length and the choices will suit your little one's age.",
  "Pick up to 3 characters to be central to the story, or invent a brand-new one together.",
  "Pick a kind of story, or describe your own idea in a line.",
];

/** The story wizard. The page has already checked who's signed in (`me`)
 *  and read their characters (`initialCharacters`; null if it couldn't),
 *  so the first step shows at once. */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function CreateWizard({ me, initialCharacters }: { me: { id: string; username: string }; initialCharacters: SavedCharacter[] | null }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState<Step>(0);
  const { night } = useNightMode();
  const [age, setAge] = useState<AgeId | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("all");
  // (the family's characters as they were last seen show at once; the
  // server is still asked)
  const [saved, setSaved] = useState<SavedCharacter[]>(() => initialCharacters ?? recall<SavedCharacter[]>("characters") ?? []);
  const [savedLoaded, setSavedLoaded] = useState(() => initialCharacters !== null || recall("characters") !== undefined);
  useEffect(() => {
    if (savedLoaded) remember("characters", saved);
  }, [saved, savedLoaded]);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [creatingCharacter, setCreatingCharacter] = useState(false);

  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [themeText, setThemeText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedAge = localStorage.getItem(AGE_KEY) as AgeId | null;
      if (savedAge && AGES.some((a) => a.id === savedAge)) setAge(savedAge);
      const savedMinutes = Number(localStorage.getItem(MINUTES_KEY));
      if (Number.isFinite(savedMinutes) && savedMinutes >= MIN_MINUTES && savedMinutes <= MAX_MINUTES) setMinutes(lengthOf(savedMinutes).minutes);
    } catch {}
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in?next=/create");
    else if (status === "authenticated" && !session?.user.username) router.replace("/welcome?next=/create");
  }, [status, session, router]);

  useEffect(() => {
    // (already here from the page: no need to ask again)
    if (status !== "authenticated" || initialCharacters) return;
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d: { characters?: SavedCharacter[] }) => setSaved(d.characters ?? []))
      .catch(() => {})
      .finally(() => setSavedLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const defForUid = (uid: string): CharacterDef | null => {
    if (uid.startsWith("saved:")) {
      const c = saved.find((s) => s.id === uid.slice(6));
      return c ? { id: c.id, name: c.name, look: c.look, preset: null, svg: c.svg, notes: c.notes, relationships: c.relationships ?? null, savedId: c.id, gender: c.gender } : null;
    }
    if (uid.startsWith("preset:")) {
      const p = PRESETS.find((pp) => pp.key === uid.slice(7));
      return p ? presetCharacter(p) : null;
    }
    return null;
  };
  const selectedDefs = selectedUids.map(defForUid).filter((d): d is CharacterDef => Boolean(d));
  const hero: CharacterDef | null = selectedDefs[0] ? { ...selectedDefs[0], id: "hero" } : null;
  const companions: CharacterDef[] = selectedDefs.slice(1).map((d, i) => ({ ...d, id: `companion${i + 1}` }));
  const atCap = selectedUids.length >= MAX_CENTRAL;
  const toggleSelect = (uid: string) => {
    setSelectedUids((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : cur.length >= MAX_CENTRAL ? cur : [...cur, uid]));
  };

  const theme = themeText.trim() || THEMES.find((t) => t.key === themeKey)?.line || "";
  const canNext = step === 0 ? Boolean(age) : step === 1 ? Boolean(hero) : Boolean(theme);
  // (the standard story, unless another length is picked)
  const effectiveMinutes = minutes ?? STANDARD_LENGTH.minutes;
  const lengthIndex = Math.max(0, STORY_LENGTHS.findIndex((l) => l.minutes === lengthOf(effectiveMinutes).minutes));
  const visiblePresets = useMemo(() => PRESETS.filter((p) => group === "all" || p.group === group), [group]);

  const charLimit = useCharacterLimit();
  const [checking, setChecking] = useState(false);

  // Before the first step: is there room for a new story today, and is one
  // already under way? (One story at a time: beginning another replaces it.)
  const ongoing = useOngoingStory();
  const [limit, setLimit] = useState<LimitNotice | null>(null);
  // (how many more stories the plan lets this account begin; unknown or
  // unlimited: null)
  const [startsLeft, setStartsLeft] = useState<number | null>(null);
  const [daily, setDaily] = useState("for now");
  // Credits a minute this story will cost (null: it's on the plan, free).
  const [perMinute, setPerMinute] = useState<number | null>(null);
  const storyCost = useMakingCost("story");
  // (from the check made as the wizard opens, or - until that answers - from the account's own figures)
  const creditsPerMinute = perMinute ?? storyCost.perMinute;
  const [replacing, setReplacing] = useState<"ask" | "busy" | "done">("ask");
  // One of the plan's free stories is there to use: how long it can be,
  // and what the account holds for a longer one (null: none to use).
  const freeStory = useRef<{ minutes: number; perMinute: number; balance: number | null } | null>(null);
  // (the same, for what the page shows: how long a free story can be)
  const [freeMax, setFreeMax] = useState<{ minutes: number; perMinute: number } | null>(null);
  // "A free story is up to 5 minutes": asked when a longer one is chosen.
  const [tooLong, setTooLong] = useState<{ minutes: number; freeMinutes: number; cost: number; balance: number | null } | null>(null);
  const askAllowance = async (): Promise<LimitNotice | null | "failed"> => {
    try {
      const res = await fetch("/api/story", { cache: "no-store", headers: deviceHeader() });
      const data = (await res.json()) as { canStart?: boolean; error?: string; limited?: string; plan?: string; startsLeft?: number; windowHours?: number; credits?: { perMinute: number; balance: number }; free?: { minutes: number; perMinute: number; balance: number | null } };
      freeStory.current = data.canStart && data.free ? data.free : null;
      setFreeMax(freeStory.current ? { minutes: freeStory.current.minutes, perMinute: freeStory.current.perMinute } : null);
      setDaily(data.windowHours === 168 ? "this week" : data.windowHours === 24 ? "today" : "for now");
      // (the plan's free story is used: this one will be paid for with credits)
      setPerMinute(data.credits ? data.credits.perMinute : null);
      setStartsLeft(typeof data.startsLeft === "number" ? data.startsLeft : null);
      if (data.canStart) return null;
      return { limited: data.limited, plan: data.plan, message: data.error || "A new story can't begin just now." };
    } catch {
      return "failed";
    }
  };
  useEffect(() => {
    // (asked at once: the page knows they're signed in)
    if (status === "unauthenticated") return;
    let live = true;
    void askAllowance().then((n) => live && n !== "failed" && setLimit(n));
    return () => {
      live = false;
    };
  }, [status]);
  const leave = () => router.push("/home");
  // (Escape on "start a new one?": back home, as a tap
  // outside does)
  useEscape(() => replacing !== "busy" && leave(), !limit && Boolean(ongoing.story && replacing !== "done"));
  /** `length`: the minutes to make it (the slider's, unless the "free
   *  stories are up to 5 minutes" question has just been answered - then
   *  what was answered, which also means: don't ask again). */
  useEscape(() => setTooLong(null), Boolean(tooLong));
  const start = async (length?: number) => {
    if (!age || !hero || !theme || checking) return;
    const storyMinutes = length ?? effectiveMinutes;
    // New stories are limited (one per day on Free, unlimited for the admin):
    // check first, so hitting the limit never leaves an empty story behind.
    setChecking(true);
    setError(null);
    const notice = await askAllowance();
    setChecking(false);
    if (notice === "failed") {
      setError("Couldn't start a story just now. Please check your connection and try again.");
      return;
    }
    if (notice) {
      setLimit(notice);
      return;
    }
    // A free story can be up to so many minutes. Longer than that, it's
    // asked: keep the length and pay with credits, or make it a free one?
    const f = freeStory.current;
    if (length === undefined && f && storyMinutes > f.minutes) {
      setTooLong({ minutes: storyMinutes, freeMinutes: f.minutes, cost: storyMinutes * f.perMinute, balance: f.balance });
      return;
    }
    // (one at a time: anything left unfinished - say, begun in another tab
    // since this page opened - makes way for this one)
    await ongoing.discard({ all: true });
    // (an idea that was waiting for later has now been begun)
    if (fromIdea) forgetIdea(session?.user.id ?? me.id);
    try {
      localStorage.setItem(AGE_KEY, age);
      localStorage.setItem(MINUTES_KEY, String(storyMinutes));
    } catch {}
    const story: Story = {
      id: newId(),
      title: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      age,
      minutes: storyMinutes,
      theme,
      world: "",
      hero,
      companions,
      cast: [],
      segments: [],
      status: "new",
      rating: 0,
      authorId: session?.user.id ?? me.id,
      authorUsername: session?.user.username ?? me.username,
    };
    if (!saveStory(story)) {
      setError("This device's storage is full. Remove an old story from your bookshelf and try again.");
      return;
    }
    // Remember which of the user's own characters starred in this story
    // (fire-and-forget; keepalive lets it finish across the navigation).
    const savedIds = [hero, ...companions].map((c) => c.savedId).filter((x): x is string => Boolean(x));
    if (savedIds.length) {
      fetch("/api/characters/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyId: story.id, characterIds: savedIds }),
        keepalive: true,
      }).catch(() => {});
    }
    router.push(`/story/${story.id}`);
  };

  // Arriving with a ready-made idea ("Start a new adventure now?"): the
  // cast and the idea are filled in. "Change it first" opens on the
  // characters; "Start now" begins at once when nothing stands in the way
  // (an age already chosen, no story under way to replace) - otherwise it
  // stops on the last step, one tap from beginning.
  const [fromIdea, setFromIdea] = useState(false);
  const [autoGo, setAutoGo] = useState(false);
  useEffect(() => {
    if (!savedLoaded) return;
    const h = takeHandover();
    if (!h) return;
    const uids = h.uids.filter((u) => (u.startsWith("saved:") ? saved.some((c) => c.id === u.slice(6)) : PRESETS.some((p) => `preset:${p.key}` === u))).slice(0, MAX_CENTRAL);
    if (!uids.length) return;
    setSelectedUids(uids);
    setThemeText(h.line.slice(0, 160));
    setFromIdea(true);
    setStep(h.go ? (age ? 2 : 0) : 1);
    setAutoGo(h.go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLoaded]);
  useEffect(() => {
    if (!autoGo || ongoing.story === undefined) return;
    if (ongoing.story || limit || !age || !hero || !theme) return setAutoGo(false);
    setAutoGo(false);
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGo, ongoing.story, limit, age, hero, theme]);

  const next = () => {
    if (!canNext) return;
    if (step < 2) {
      setStep((s) => (s + 1) as Step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else void start();
  };


  return (
    <div className={`container wizard${step === 0 && !night ? " with-bedtime-hint" : ""}`}>
      {/* (by daylight, a pencilled nudge towards the night-mode switch) */}
      {step === 0 && <BedtimeHint />}
      <header className="wizard-head">
        <p className="eyebrow">Chapter {["the First", "the Second", "the Third"][step]}</p>
        <h1>{STEP_TITLES[step]}</h1>
        <p className="sub">{STEP_NOTES[step]}</p>
      </header>

      {step === 0 && (
        <div className="grid ages" role="radiogroup" aria-label="Child's age">
          {AGES.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={age === a.id}
              className={`plate ${age === a.id ? "selected" : ""}`}
              onClick={() => setAge(a.id)}
            >
              <span className="plate-label">{a.label}</span>
              <span className="plate-sub">{a.blurb}</span>
            </button>
          ))}
        </div>
      )}

      {step === 0 && age && (
        <section className="panel length-panel">
          <h3>How far shall we go tonight?</h3>
          {/* three stops on a slider: each stop's picture above the line, its name and time below (tap either to choose it) */}
          <div className="length-stops length-stops-art">
            {STORY_LENGTHS.map((l) => (
              <button key={l.id} type="button" tabIndex={-1} aria-hidden className={`length-stop ${effectiveMinutes === l.minutes ? "selected" : ""}`} onClick={() => setMinutes(l.minutes)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="length-stop-art painted-edge-square" src={`/art/lengths/${l.id}.webp`} alt="" width={160} height={160} />
              </button>
            ))}
          </div>
          <input
            type="range"
            className="length-slider length-slider-3"
            min={0}
            max={STORY_LENGTHS.length - 1}
            step={1}
            value={lengthIndex}
            onChange={(e) => setMinutes(STORY_LENGTHS[Number(e.target.value)].minutes)}
            aria-label="Story length"
            aria-valuetext={`${STORY_LENGTHS[lengthIndex].name}: ${timeWords(STORY_LENGTHS[lengthIndex].minutes)} minutes, ${STORY_LENGTHS[lengthIndex].minutes} credits`}
            style={{ background: `linear-gradient(to right, var(--russet) ${(lengthIndex / (STORY_LENGTHS.length - 1)) * 100}%, var(--rule) 0%)` }}
          />
          <div className="length-stops length-stops-words">
            {STORY_LENGTHS.map((l) => (
              <button key={l.id} type="button" tabIndex={-1} className={`length-stop ${effectiveMinutes === l.minutes ? "selected" : ""}`} onClick={() => setMinutes(l.minutes)} aria-label={`${l.name}: ${timeWords(l.minutes)} minutes${freeMax ? (l.minutes > freeMax.minutes ? `, your free story and ${(l.minutes - freeMax.minutes) * freeMax.perMinute} credits` : ", your free story") : `, ${l.minutes} credits`}`}>
                <span className="length-stop-name">{l.name}</span>
                <span className="length-stop-facts">{l.time} min</span>
                {/* What it will take from the account. With a free story to
                    use, a Quest takes nothing (and says nothing); an
                    Adventure or an Odyssey is paid in full. */}
                {(() => {
                  // (until it's known which it will be, nothing is said)
                  const extra = freeMax ? (l.minutes > freeMax.minutes ? l.minutes * freeMax.perMinute : 0) : creditsPerMinute ? l.minutes * creditsPerMinute : 0;
                  if (!extra) return <span className="length-stop-cost none" aria-hidden />;
                  return (
                    <span className="length-stop-cost">
                      {extra}
                      <CreditIcon size={15} />
                    </span>
                  );
                })()}
              </button>
            ))}
          </div>
          {freeMax && <p className="length-free-note">Your plan&apos;s free story is a Quest. An Adventure or an Odyssey is paid with credits.</p>}
        </section>
      )}

      {step === 1 && (
        <>
          <p className="meta selection-count">
            {selectedUids.length === 0
              ? `Choose up to ${MAX_CENTRAL} central characters.`
              : `${selectedUids.length} of ${MAX_CENTRAL} chosen${atCap ? " - that's the limit for one story" : ""}.`}
          </p>

          <section className="panel panel-invent hero-maker">
            <div className="hero-maker-head">
              <h3>Dream up a hero</h3>
              <span className="meta">
                {Number.isFinite(charLimit) ? `${saved.length}/${charLimit}` : saved.length}
                {saved.length >= charLimit && (
                  <>
                    {" · "}
                    <button type="button" className="link-btn" onClick={() => setCreatingCharacter(true)}>
                      Replace one
                    </button>
                  </>
                )}
              </span>
            </div>
            {saved.length === 0 ? (
              // No characters yet: one clear invitation, not an empty grid.
              <button type="button" className="hero-dream-btn" onClick={() => setCreatingCharacter(true)}>
                <span className="hero-dream-plus" aria-hidden>
                  +
                </span>
                <span>
                  <span className="hero-dream-title">Dream up your own character</span>
                  <span className="hero-dream-sub">Describe them - we&apos;ll paint them.</span>
                </span>
              </button>
            ) : (
              <SideScroll className="hero-slots" label="More of your characters">
                {/* your characters, then one "New" slot while there's room */}
                {[...saved, ...(saved.length < charLimit ? [null] : [])].map((c, i) => {
                  if (!c) {
                    return (
                      <button key={`empty-${i}`} type="button" className="hero-slot hero-slot-empty" onClick={() => setCreatingCharacter(true)} aria-label="Create a new character">
                        <span className="hero-slot-art">+</span>
                        <span className="hero-slot-name">New</span>
                      </button>
                    );
                  }
                  const uid = `saved:${c.id}`;
                  const selected = selectedUids.includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      className={`hero-slot ${selected ? "selected" : ""}`}
                      aria-pressed={selected}
                      data-order={selected ? selectedUids.indexOf(uid) + 1 : undefined}
                      disabled={!selected && atCap}
                      onClick={() => toggleSelect(uid)}
                    >
                      <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} className="hero-slot-art" />
                      <span className="hero-slot-name">{c.name}</span>
                    </button>
                  );
                })}
              </SideScroll>
            )}
          </section>

          {creatingCharacter && (
            <CharacterCreatorModal
              existing={saved}
              onClose={() => setCreatingCharacter(false)}
              onConfirmed={(character) => {
                setSaved((cur) => {
                  const kept = cur.filter((c) => c.id !== character.id);
                  return [...kept, character];
                });
                const uid = `saved:${character.id}`;
                setSelectedUids((cur) => (cur.includes(uid) ? cur : cur.length >= MAX_CENTRAL ? cur : [...cur, uid]));
                setCreatingCharacter(false);
              }}
            />
          )}

          <p className="divider-label">Choose a friend</p>

          <div className="filter-row">
            <Segmented options={GROUPS} value={group} onChange={setGroup} label="Kinds of friend" />
          </div>
          <div className="grid chars">
            {visiblePresets.map((p) => {
              const uid = `preset:${p.key}`;
              const selected = selectedUids.includes(uid);
              const order = selectedUids.indexOf(uid) + 1;
              return (
                <button
                  key={uid}
                  type="button"
                  className={`plate char-plate ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  data-order={selected ? order : undefined}
                  disabled={!selected && atCap}
                  onClick={() => toggleSelect(uid)}
                >
                  <CharacterPortrait character={presetCharacter(p)} />
                  <span className="plate-label">{p.name}</span>
                  <span className="plate-sub">the {p.kind}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <section className="panel panel-invent">
            <h3>Dream up the tale</h3>
            <p className="meta">Say it out loud, or type it: &ldquo;the moon has lost its hat&rdquo;.</p>
            <div className="field-row">
              <DictateButton onText={setThemeText} label="Say your idea" />
              <GrowingInput
                value={themeText}
                maxLength={160}
                placeholder="The moon has lost its hat…"
                onChange={setThemeText}
                onEnter={next}
                aria-label="Your own story idea"
              />
            </div>
          </section>

          <p className="divider-label">Or pick a kind of story</p>

          <div className="grid themes">
            {THEMES.map((t) => {
              const selected = !themeText.trim() && themeKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`plate theme-plate ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setThemeKey(t.key);
                    setThemeText("");
                  }}
                >
                  <span className="plate-label">{t.label}</span>
                  <span className="plate-sub">{t.line}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}

      {limit ? (
        <LimitDialog notice={limit} onClose={leave}>
          {ongoing.story && (
            <button type="button" className="btn btn-primary btn-block" onClick={ongoing.resume}>
              <MapleMark />
              Carry on with your story
            </button>
          )}
        </LimitDialog>
      ) : (
        ongoing.story &&
        replacing !== "done" && (
          // (laid out like the app's other "this can't be undone" dialogs)
          <div className="modal-backdrop" onClick={() => replacing !== "busy" && leave()}>
            <div className="modal-panel confirm-panel" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="confirm-replace-story">
              {coverOf(ongoing.story) && (
                <span className="confirm-cover">
                  <Painting svg={coverOf(ongoing.story)!} title={titleOf(ongoing.story)} />
                </span>
              )}
              <h3 id="confirm-replace-story">Start a new story?</h3>
              <p className="confirm-warning">
                One story at a time: starting a new one deletes &ldquo;{titleOf(ongoing.story)}&rdquo; for good. This can&apos;t be undone.
              </p>
              <DiscardCreditsNote />
              <div className="redraw-choices">
                <button
                  type="button"
                  className="btn btn-danger btn-block"
                  disabled={replacing === "busy"}
                  onClick={async () => {
                    setReplacing("busy");
                    await ongoing.discard({ all: true });
                    setReplacing("done");
                  }}
                >
                  {replacing === "busy" ? (
                    <>
                      <LeafLoader size={18} /> Deleting…
                    </>
                  ) : (
                    "Delete and start a new story"
                  )}
                </button>
                <button type="button" className="btn btn-soft btn-block" onClick={ongoing.resume} disabled={replacing === "busy"}>
                  Carry on with this story
                </button>
              </div>
              {startsLeft !== null && startsLeft <= 2 && (
                <p className="meta starts-left">
                  {startsLeft === 1
                    ? `This is the last new story you can start ${daily}.`
                    : `You can start ${startsLeft} more new stories ${daily}.`}
                </p>
              )}
            </div>
          </div>
        )
      )}

      {tooLong && (
        <div className="modal-backdrop" onClick={() => setTooLong(null)}>
          <div className="modal-panel draft-prompt free-length" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="free-length-title">
            <div className="modal-head">
              <h3 id="free-length-title">Your free story is a Quest</h3>
              <button type="button" className="icon-btn" onClick={() => setTooLong(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="limit-message">
              {cap(aLength(lengthOf(tooLong.minutes)))} is paid with credits ({tooLong.cost}), and your free Quest stays for another night. Or make it a Quest, free.
            </p>
            <div className="story-preview-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={tooLong.balance !== null && tooLong.balance < tooLong.cost}
                onClick={() => {
                  const m = tooLong.minutes;
                  setTooLong(null);
                  void start(m);
                }}
              >
                <MakeLabel credits={tooLong.cost}>Keep the {lengthOf(tooLong.minutes).name}</MakeLabel>
              </button>
              {tooLong.balance !== null && tooLong.balance < tooLong.cost && (
                <p className="meta free-length-short">
                  That needs {tooLong.cost} credit{tooLong.cost === 1 ? "" : "s"}, and there {tooLong.balance === 1 ? "is" : "are"} {tooLong.balance} in your account.
                </p>
              )}
              <button
                type="button"
                className="btn btn-soft btn-block"
                onClick={() => {
                  const m = tooLong.freeMinutes;
                  setTooLong(null);
                  setMinutes(m);
                  void start(m);
                }}
              >
                Make it {aLength(lengthOf(tooLong.freeMinutes))}, free
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="wizard-nav" aria-label="Move between steps">
        {step > 0 && (
          <button type="button" className="wizard-back" onClick={() => setStep((s) => (s - 1) as Step)} aria-label="Back">
            ‹
          </button>
        )}
        <button type="button" className="btn btn-primary wizard-cta" onClick={next} disabled={!canNext || checking}>
          {checking ? (
            <>
              <LeafLoader size={18} /> Getting ready…
            </>
          ) : (
            step === 2 ? (
              // (what it takes: credits for its minutes, or one of the plan's free stories)
              <MakeLabel
                icon={<MapleMark />}
                credits={creditsPerMinute ? effectiveMinutes * creditsPerMinute : freeMax && effectiveMinutes > freeMax.minutes ? effectiveMinutes * freeMax.perMinute : null}
                free={creditsPerMinute || (freeMax && effectiveMinutes > freeMax.minutes) ? null : storyCost.free}
              >
                Create story
              </MakeLabel>
            ) : (
              <>
                <MapleMark />
                Next ›
              </>
            )
          )}
        </button>
      </nav>
    </div>
  );
}
