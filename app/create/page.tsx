"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AGES, type AgeId, ageById } from "@/lib/ages";
import { PRESETS, THEMES, presetCharacter, type Preset } from "@/lib/presets";
import type { CharacterDef, CharacterResponse, Story } from "@/lib/types";
import { newId, saveStory } from "@/lib/storage";
import { CharacterAvatar } from "@/components/art/CharacterArt";
import { DictateButton } from "@/components/DictateButton";

const AGE_KEY = "taleo.age";
type Step = 0 | 1 | 2;
const GROUPS = [
  { key: "all", label: "All" },
  { key: "animal", label: "Animals" },
  { key: "food", label: "Yummy" },
  { key: "object", label: "Things" },
] as const;

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
    if (!customDesc.trim()) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: customDesc, name: heroName || undefined }),
      });
      const data = (await res.json()) as CharacterResponse & { error?: string };
      if (!res.ok || !data.character) throw new Error(data.error || "Couldn't draw that one. Try again?");
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
      hero: { ...hero, id: "hero" },
      cast: [],
      customProps: [],
      segments: [],
      status: "new",
      rating: 0,
    };
    if (!saveStory(story)) {
      setError("Your device storage is full. Delete an old story in My stories and try again.");
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
      <div className="wizard-head">
        <h1>{["Who's listening?", "Pick a star character", "What's the story about?"][step]}</h1>
        <div className="progress" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <>
          <p className="sub">We&apos;ll match the words, length and choices to your little one&apos;s age.</p>
          <div className="grid ages" role="radiogroup" aria-label="Child's age">
            {AGES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={age === a.id}
                className={`tile ${age === a.id ? "selected" : ""}`}
                onClick={() => setAge(a.id)}
              >
                <div className="emoji">{a.emoji}</div>
                <div className="t-label">{a.label}</div>
                <div className="t-blurb">{a.blurb}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <p className="sub">Choose a friend, or invent a brand-new one together.</p>
          <div className="filter-row">
            {GROUPS.map((g) => (
              <button key={g.key} type="button" className={`chip ${group === g.key ? "on" : ""}`} onClick={() => setGroup(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid chars">
            {visiblePresets.map((p) => {
              const selected = !useCustom && presetKey === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`tile char-tile ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setPresetKey(p.key);
                    setUseCustom(false);
                    setHeroName("");
                  }}
                >
                  <CharacterAvatar def={presetCharacter(p)} expression={selected ? "excited" : "happy"} pose={selected ? "jump" : "stand"} animate={selected} />
                  <div className="t-label">{p.name}</div>
                  <div className="t-blurb">{p.key}</div>
                </button>
              );
            })}
            {custom && (
              <button
                type="button"
                className={`tile char-tile ${useCustom ? "selected" : ""}`}
                aria-pressed={useCustom}
                onClick={() => setUseCustom(true)}
              >
                <CharacterAvatar def={custom} expression={useCustom ? "excited" : "happy"} pose={useCustom ? "jump" : "stand"} animate={useCustom} />
                <div className="t-label">{custom.name}</div>
                <div className="t-blurb">your creation</div>
              </button>
            )}
          </div>

          <div className="panel">
            <h3>✏️ Invent your own character</h3>
            <p className="sub" style={{ marginBottom: 12 }}>
              Describe it, or tap the mic and let your child say it — &ldquo;a purple giraffe with rainbow spots&rdquo;.
            </p>
            <div className="field-row">
              <input
                className="input"
                value={customDesc}
                maxLength={200}
                placeholder="A sleepy pink whale who loves pancakes…"
                onChange={(e) => setCustomDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && drawCustom()}
                aria-label="Describe your character"
              />
              <DictateButton onText={setCustomDesc} label="Describe by voice" />
              <button type="button" className="btn btn-primary" onClick={drawCustom} disabled={!customDesc.trim() || drawing}>
                {drawing ? "Painting…" : "🎨 Draw it"}
              </button>
            </div>
          </div>

          {hero && (
            <div className="panel">
              <div className="summary">
                <CharacterAvatar def={hero} expression="happy" pose="wave" animate />
                <div style={{ flex: "1 1 220px" }}>
                  <h3>Our hero&apos;s name</h3>
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
              </div>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <p className="sub">Pick a kind of story, or describe your own in one line.</p>
          <div className="grid themes">
            {THEMES.map((t) => {
              const selected = !themeText.trim() && themeKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`tile ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setThemeKey(t.key);
                    setThemeText("");
                  }}
                >
                  <div className="emoji">{t.emoji}</div>
                  <div className="t-label">{t.label}</div>
                </button>
              );
            })}
          </div>
          <div className="panel">
            <h3>💡 Or your own idea</h3>
            <div className="field-row">
              <input
                className="input"
                value={themeText}
                maxLength={160}
                placeholder="Looking for the moon's lost hat…"
                onChange={(e) => setThemeText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
                aria-label="Your own story idea"
              />
              <DictateButton onText={setThemeText} label="Say your idea" />
            </div>
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}

      <div className="wizard-foot">
        <button type="button" className="btn btn-ghost" onClick={() => (step === 0 ? router.push("/") : setStep((s) => (s - 1) as Step))}>
          ← Back
        </button>
        <span className="meta" style={{ textAlign: "center" }}>
          {age && step > 0 ? `Age ${ageById(age).label}` : ""}
          {hero && step > 1 ? ` · ${hero.name}` : ""}
        </span>
        <button type="button" className="btn btn-primary" onClick={next} disabled={!canNext}>
          {step === 2 ? "✨ Make our story" : "Next →"}
        </button>
      </div>
    </div>
  );
}
