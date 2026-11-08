"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AGES, MAX_MINUTES, MIN_MINUTES, type AgeId, ageById } from "@/lib/ages";
import { PRESETS, THEMES, presetCharacter } from "@/lib/presets";
import type { CharacterDef, SavedCharacter, Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { CharacterPortrait } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";
import { CharacterCreatorModal } from "@/components/CharacterCreatorModal";

const AGE_KEY = "taleo.age";
const MINUTES_KEY = "taleo.minutes";
const MAX_CENTRAL = 3;
type Step = 0 | 1 | 2;
const GROUPS = [
  { key: "mine", label: "My creations" },
  { key: "all", label: "Everyone" },
  { key: "animal", label: "Animals" },
  { key: "food", label: "Good enough to eat" },
  { key: "object", label: "Curious things" },
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
      .catch(() => {});
  }, [status]);

  const defForUid = (uid: string): CharacterDef | null => {
    if (uid.startsWith("saved:")) {
      const c = saved.find((s) => s.id === uid.slice(6));
      return c ? { id: c.id, name: c.name, look: c.look, preset: null, svg: c.svg } : null;
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

  const start = () => {
    if (!age || !hero || !theme || !session?.user.username) return;
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
    router.push(`/story/${story.id}`);
  };

  const next = () => {
    if (!canNext) return;
    if (step < 2) {
      setStep((s) => (s + 1) as Step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else start();
  };

  if (status !== "authenticated" || !session?.user.username) return null;

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

          <section className="panel panel-invent">
            <h3>Dream up a hero</h3>
            <p className="meta">Paint a brand-new character - once you confirm them, they're saved to your roster for any story.</p>
            <div className="field-row">
              <button type="button" className="btn btn-primary" onClick={() => setCreatingCharacter(true)}>
                Dream up a character
              </button>
            </div>
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
              <button key={g.key} type="button" role="tab" aria-selected={group === g.key} className={`chip ${group === g.key ? "on" : ""}`} onClick={() => setGroup(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          {group === "mine" ? (
            saved.length === 0 ? (
              <p className="meta">You haven&apos;t created a character yet - try &ldquo;Dream up a character&rdquo; above.</p>
            ) : (
              <div className="grid chars">
                {saved.map((c) => {
                  const uid = `saved:${c.id}`;
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
                      <CharacterPortrait character={{ preset: null, svg: c.svg, name: c.name }} />
                      <span className="plate-label">{c.name}</span>
                      <span className="plate-sub">yours</span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
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
          )}
        </>
      )}

      {step === 2 && (
        <>
          <section className="panel panel-invent">
            <h3>Dream up the tale</h3>
            <p className="meta">Say it out loud, or type it: &ldquo;the moon has lost its hat&rdquo;.</p>
            <div className="field-row">
              <DictateButton onText={setThemeText} label="Say your idea" />
              <input
                className="input"
                value={themeText}
                maxLength={160}
                placeholder="The moon has lost its hat…"
                onChange={(e) => setThemeText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
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

      <nav className="wizard-nav" aria-label="Move between steps">
        {step > 0 && (
          <button type="button" className="wizard-back" onClick={() => setStep((s) => (s - 1) as Step)} aria-label="Back">
            ‹
          </button>
        )}
        <button type="button" className="btn btn-primary wizard-cta" onClick={next} disabled={!canNext}>
          {step === 2 ? "Begin the story" : "Next ›"}
        </button>
      </nav>
    </div>
  );
}
