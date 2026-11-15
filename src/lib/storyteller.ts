/** The storyteller settings the admin can switch between (see the switch
 *  at the top of the admin's account menu, and server/storyteller). */
export type StorytellerMode = "sonnet-medium" | "opus-low" | "opus-low-fast";
export interface Storyteller {
  model: string;
  effort: "low" | "medium" | "high";
  fast: boolean;
}
export const STORYTELLER_MODES: { id: StorytellerMode; label: string; detail: string; is: Storyteller }[] = [
  { id: "sonnet-medium", label: "Sonnet", detail: "Sonnet 5.5, medium effort: quicker, half the price", is: { model: "claude-sonnet-5-5", effort: "medium", fast: false } },
  { id: "opus-low", label: "Opus", detail: "Opus 5.5, low effort", is: { model: "claude-opus-5-5", effort: "low", fast: false } },
  { id: "opus-low-fast", label: "Opus fast", detail: "Opus 5.5, low effort, fast mode: quickest, twice Opus's price", is: { model: "claude-opus-5-5", effort: "low", fast: true } },
];
export const isStorytellerMode = (v: unknown): v is StorytellerMode => STORYTELLER_MODES.some((m) => m.id === v);
/** Which of the modes a setting is, if any. */
export const modeOf = (s: Storyteller): StorytellerMode | null =>
  STORYTELLER_MODES.find((m) => m.is.model === s.model && m.is.effort === s.effort && m.is.fast === s.fast)?.id ?? null;
