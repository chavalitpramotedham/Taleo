"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AGES, type AgeId, ageById } from "@/lib/ages";
import { PRESETS, THEMES, presetCharacter, type Preset } from "@/lib/presets";
import type { CharacterDef, CharacterResponse, Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { CharacterPortrait } from "@/components/art/Painting";
import { DictateButton } from "@/components/DictateButton";

const AGE_KEY = "taleo.age";
type Step = 0 | 1 | 2;
const GROUPS = [
  { key: "all", label: "Everyone" },
  { key: "animal", label: "Animals" },
  { key: "food", label: "Good enough to eat" },
  { key: "object", label: "Curious things" },
] as const;
const STEP_TITLES = ["Who is the story for?", "Who shall it be about?", "What shall happen?"];
const STEP_NOTES = [
  "The words, the length and the choices will suit your little one's age.",
  "Choose a friend from the shelf, or invent a brand-new one together.",
  "Pick a kind of story, or describe your own idea in a line.",
];

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [age, setAge] = useState<AgeId | null>(null);

  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("all");
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [heroName, setHeroName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [custom, setCustom] = useState<CharacterDef | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [themeText, setThemeText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AGE_KEY) as AgeId | null;
      if (saved && AGES.some((a) => a.id === saved)) setAge(saved);
    } catch {}
  }, []);

  const preset: Preset | undefined = PRESETS.find((p) => p.key === presetKey);
  const hero: CharacterDef | null = useCustom
    ? custom && { ...custom, name: heroName.trim() || custom.name }
    : preset
      ? presetCharacter(preset, heroName)
      : null;

  const theme = themeText.trim() || THEMES.find((t) => t.key === themeKey)?.line || "";
  const canNext = step === 0 ? Boolean(age) : step === 1 ? Boolean(hero) : Boolean(theme);
  const visiblePresets = useMemo(() => PRESETS.filter((p) => group === "all" || p.group === group), [group]);

  const drawCustom = async () => {
    if (!customDesc.trim() || drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: customDesc, name: heroName || undefined }),
      });
      const data = (await res.json()) as CharacterResponse & { error?: string };
      if (!res.ok || !data.character) throw new Error(data.error || "Couldn't paint that one. Try again?");
      setCustom(data.character);
      setUseCustom(true);
      setPresetKey(null);
      if (!heroName) setHeroName(data.character.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setDrawing(false);
    }
  };

  const start = () => {
    if (!age || !hero || !theme) return;
    try {
      localStorage.setItem(AGE_KEY, age);
    } catch {}
    const story: Story = {
      id: newId(),
      title: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      age,
      theme,
      world: "",
      hero: { ...hero, id: "hero" },
      cast: [],
      segments: [],
      status: "new",
      rating: 0,
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

      {step === 1 && (
        <>
          <section className="panel panel-invent">
            <h3>Dream up a hero</h3>
            <p className="meta">Say it out loud, or type it: &ldquo;a little purple giraffe with spotty socks&rdquo;.</p>
            <div className="field-row">
              <DictateButton onText={setCustomDesc} label="Describe by voice" />
              <input
                className="input"
                value={customDesc}
                maxLength={200}
                placeholder="A sleepy hedgehog who loves pancakes…"
                onChange={(e) => setCustomDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && drawCustom()}
                aria-label="Describe your character"
              />
              <button type="button" className="btn btn-primary" onClick={drawCustom} disabled={!customDesc.trim() || drawing}>
                {drawing ? "Painting…" : "Paint them"}
              </button>
            </div>
          </section>

          <p className="divider-label">Or choose a friend from the shelf</p>

          <div className="filter-row" role="tablist">
            {GROUPS.map((g) => (
              <button key={g.key} type="button" role="tab" aria-selected={group === g.key} className={`chip ${group === g.key ? "on" : ""}`} onClick={() => setGroup(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid chars">
            {custom && (
              <button type="button" className={`plate char-plate ${useCustom ? "selected" : ""}`} aria-pressed={useCustom} onClick={() => setUseCustom(true)}>
                <CharacterPortrait character={custom} />
                <span className="plate-label">{custom.name}</span>
                <span className="plate-sub">your own</span>
              </button>
            )}
            {visiblePresets.map((p) => {
              const selected = !useCustom && presetKey === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`plate char-plate ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setPresetKey(p.key);
                    setUseCustom(false);
                    setHeroName("");
                  }}
                >
                  <CharacterPortrait character={presetCharacter(p)} />
                  <span className="plate-label">{p.name}</span>
                  <span className="plate-sub">the {p.kind}</span>
                </button>
              );
            })}
          </div>

          {hero && (
            <section className="panel hero-panel">
              <CharacterPortrait character={hero} className="hero-portrait" />
              <div className="hero-name">
                <h3>And their name is…</h3>
                <div className="field-row">
                  <input
                    className="input"
                    value={heroName}
                    maxLength={30}
                    placeholder={useCustom ? custom?.name : preset?.name}
                    onChange={(e) => setHeroName(e.target.value)}
                    aria-label="Character name"
                  />
                  <DictateButton onText={setHeroName} label="Say a name" />
                </div>
              </div>
            </section>
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

      <div className="wizard-foot">
        <button type="button" className="btn btn-ghost" onClick={() => (step === 0 ? router.push("/") : setStep((s) => (s - 1) as Step))}>
          ‹ Back
        </button>
        <span className="meta foot-summary">
          {age && step > 0 ? `Age ${ageById(age).label}` : ""}
          {hero && step > 1 ? ` · ${hero.name}` : ""}
        </span>
        <button type="button" className="btn btn-primary" onClick={next} disabled={!canNext}>
          {step === 2 ? "Begin the story" : "Next ›"}
        </button>
      </div>
    </div>
  );
}
