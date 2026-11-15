"use client";
import { useEffect, useState } from "react";
import { STORYTELLER_MODES, type StorytellerMode } from "@/lib/storyteller";
import { BoltIcon, OpenBookIcon, QuillIcon } from "./Icons";

const ICON: Record<StorytellerMode, React.ReactNode> = {
  "sonnet-medium": <QuillIcon />,
  "opus-low": <OpenBookIcon />,
  "opus-low-fast": <BoltIcon />,
};
/** What was last heard, so the switch shows at once when the menu opens again. */
let known: StorytellerMode | null | undefined;

/**
 * The admin's storyteller switch, at the foot of the account menu: three
 * settings side by side, like a pair of earbuds' listening modes - tap one
 * to choose it, or tap the one that's on to move to the next. Every story
 * part written from then on (on any server, within 15 seconds) uses it.
 */
export function StorytellerSwitch() {
  const [mode, setMode] = useState<StorytellerMode | null | undefined>(known);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let here = true;
    fetch("/api/admin/storyteller", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mode: StorytellerMode | null } | null) => {
        if (here && d) setMode((known = d.mode));
      })
      .catch(() => {});
    return () => {
      here = false;
    };
  }, []);
  const choose = async (next: StorytellerMode) => {
    if (busy) return;
    const before = mode;
    setMode(next);
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/storyteller", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: next }) });
      const d = (await r.json().catch(() => ({}))) as { mode?: StorytellerMode | null; error?: string };
      if (!r.ok) throw new Error(d.error || "Couldn't switch just now.");
      setMode((known = d.mode ?? next));
      // (the "what's live" line below shows the storyteller too)
      window.dispatchEvent(new Event("taleo:storyteller"));
    } catch (e) {
      setMode(before);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const at = STORYTELLER_MODES.findIndex((m) => m.id === mode);
  return (
    <div className="story-switch" aria-label="Storyteller" title={mode === null ? "Never switched: Vercel's settings are used" : undefined}>
      <div className={`story-switch-pill${busy ? " busy" : ""}`} style={{ "--at": Math.max(at, 0) } as React.CSSProperties} data-none={at < 0 || undefined}>
        <span className="story-switch-thumb" aria-hidden />
        {STORYTELLER_MODES.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="menuitemradio"
            aria-checked={m.id === mode}
            title={m.detail}
            className={m.id === mode ? "on" : ""}
            onClick={() => void choose(m.id === mode ? STORYTELLER_MODES[(i + 1) % STORYTELLER_MODES.length].id : m.id)}
          >
            {ICON[m.id]}
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      {error && <p className="story-switch-error">{error}</p>}
    </div>
  );
}
