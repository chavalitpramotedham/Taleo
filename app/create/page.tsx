"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AGES, MAX_MINUTES, MIN_MINUTES, type AgeId, ageById } from "@/lib/ages";
import { PRESETS, THEMES, presetCharacter } from "@/lib/presets";
import type { CharacterDef, SavedCharacter, Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { CharacterPortrait, Painting } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { SideScroll } from "@/components/SideScroll";
import { GrowingInput } from "@/components/GrowingInput";
import { CharacterCreatorModal } from "@/components/CharacterCreatorModal";
import { useCharacterLimit } from "@/lib/useCharacterLimit";
import { PageLoading } from "@/components/PageLoading";
import { LeafLoader, MapleMark } from "@/components/Icons";
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

export default function CreatePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState<Step>(0);
  const [age, setAge] = useState<AgeId | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("all");
  const [saved, setSaved] = useState<SavedCharacter[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
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
      if (Number.isFinite(savedMinutes) && savedMinutes >= MIN_MINUTES && savedMinutes <= MAX_MINUTES) setMinutes(savedMinutes);
    } catch {}
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in?next=/create");
    else if (status === "authenticated" && !session?.user.username) router.replace("/welcome?next=/create");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d: { characters?: SavedCharacter[] }) => setSaved(d.characters ?? []))
      .catch(() => {})
      .finally(() => setSavedLoaded(true));
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
  const recommendedMinutes = age ? ageById(age).recommendedMinutes : null;
  const effectiveMinutes = minutes ?? recommendedMinutes ?? MIN_MINUTES;
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
  const [daily, setDaily] = useState(false);
  const [replacing, setReplacing] = useState<"ask" | "busy" | "done">("ask");
  const askAllowance = async (): Promise<LimitNotice | null | "failed"> => {
    try {
      const res = await fetch("/api/story", { cache: "no-store" });
      const data = (await res.json()) as { canStart?: boolean; error?: string; limited?: string; plan?: string; startsLeft?: number; windowHours?: number };
      setDaily(data.windowHours === 24);
      setStartsLeft(typeof data.startsLeft === "number" ? data.startsLeft : null);
      if (data.canStart) return null;
      return { limited: data.limited, plan: data.plan, message: data.error || "A new story can't begin just now." };
    } catch {
      return "failed";
    }
  };
  useEffect(() => {
    if (status !== "authenticated") return;
    let live = true;
    void askAllowance().then((n) => live && n !== "failed" && setLimit(n));
    return () => {
      live = false;
    };
  }, [status]);
  const leave = () => router.push("/home");
  const start = async () => {
    if (!age || !hero || !theme || !session?.user.username || checking) return;
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
    // (one at a time: anything left unfinished - say, begun in another tab
    // since this page opened - makes way for this one)
    await ongoing.discard({ all: true });
    // (an idea that was waiting for later has now been begun)
    if (fromIdea) forgetIdea(session.user.id);
    try {
      localStorage.setItem(AGE_KEY, age);
      localStorage.setItem(MINUTES_KEY, String(effectiveMinutes));
    } catch {}
    const story: Story = {
      id: newId(),
      title: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      age,
      minutes: effectiveMinutes,
      theme,
      world: "",
      hero,
      companions,
      cast: [],
      segments: [],
      status: "new",
      rating: 0,
      authorId: session.user.id,
      authorUsername: session.user.username,
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

  if (status !== "authenticated" || !session?.user.username) return <PageLoading />;

  return (
    <div className="container wizard">
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
          <h3>How long should it be?</h3>
          <p className="meta">
            {minutes === null
              ? `Recommended for this age: about ${recommendedMinutes} minute${recommendedMinutes === 1 ? "" : "s"}. Slide to choose your own.`
              : `About ${effectiveMinutes} minute${effectiveMinutes === 1 ? "" : "s"}, read aloud.`}
          </p>
          <input
            type="range"
            className="length-slider"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            step={1}
            value={effectiveMinutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            aria-label="Story length in minutes"
            aria-valuetext={`${effectiveMinutes} minutes`}
            style={{
              background: `linear-gradient(to right, var(--russet) ${((effectiveMinutes - MIN_MINUTES) / (MAX_MINUTES - MIN_MINUTES)) * 100}%, var(--rule) 0%)`,
            }}
          />
          <div className="length-ticks" aria-hidden>
            {Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => MIN_MINUTES + i).map((m) => (
              <span key={m} className={`length-tick ${m === recommendedMinutes ? "recommended" : ""}`}>
                {m}
              </span>
            ))}
          </div>
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

          <div className="filter-row" role="tablist">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={group === g.key}
                className={`chip ${group === g.key ? "on" : ""}`}
                onClick={() => setGroup(g.key)}
              >
                {g.label}
              </button>
            ))}
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
                    ? `This is the last new story you can start ${daily ? "today" : "for now"}.`
                    : `You can start ${startsLeft} more new stories ${daily ? "today" : "for now"}.`}
                </p>
              )}
            </div>
          </div>
        )
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
            <>
              <MapleMark />
              {step === 2 ? "Begin the story" : "Next ›"}
            </>
          )}
        </button>
      </nav>
    </div>
  );
}
