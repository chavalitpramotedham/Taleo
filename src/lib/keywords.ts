import { THEMES } from "./presets";

/** The one-word keyword shown as a pill on story cards ("Family",
 *  "Adventure"…), from the writer's own choice when there is one, else
 *  worked out from the story's theme. */
const BY_THEME: Record<string, string> = {
  friends: "Friendship",
  adventure: "Adventure",
  mission: "Mission",
  family: "Family",
  bedtime: "Bedtime",
  feelings: "Feelings",
  mystery: "Mystery",
  party: "Celebration",
  nature: "Nature",
  sharing: "Kindness",
};

// For themes typed in freely: the first of these that fits.
const HINTS: [RegExp, string][] = [
  [/\b(family|mum|mom|dad|grand|sister|brother|baby)/i, "Family"],
  [/\bfriend/i, "Friendship"],
  [/\b(space|rocket|dragon|magic|fairy|wizard|unicorn|planet)/i, "Imagination"],
  [/\b(sleep|bed|night|dream)/i, "Bedtime"],
  [/\b(kind|shar|help|gentle)/i, "Kindness"],
  [/\b(brave|courage|scared|fear)/i, "Bravery"],
  [/\b(feel|sad|angry|cross|shy|worr)/i, "Feelings"],
  [/\b(myster|clue|lost|find|search)/i, "Mystery"],
  [/\b(party|birthday|celebrat)/i, "Celebration"],
  [/\b(nature|forest|garden|sea|season|snow|rain|animal)/i, "Nature"],
  [/\b(adventure|journey|explor|travel|quest)/i, "Adventure"],
];

export function storyKeyword(s: { keyword?: string | null; theme?: string | null }): string {
  const own = s.keyword?.trim();
  if (own) return own.charAt(0).toUpperCase() + own.slice(1, 24);
  const theme = (s.theme || "").trim();
  const preset = THEMES.find((t) => t.line === theme || t.label === theme);
  if (preset) return BY_THEME[preset.key] ?? "Adventure";
  return HINTS.find(([re]) => re.test(theme))?.[1] ?? "Imagination";
}
