// A page's tappable word and who acts it out, checked against the page's
// own words - on the server as a part is written, and in the reader for
// books written before (see cleanAction in server/claude).

/** The page's word as the page itself has it: the word, or a form of it
 *  ("wobble" for "wobbled", "carry" for "carried", "tiptoe" for
 *  "tiptoeing"), or null when the page doesn't say it at all. */
const IRREGULAR: Record<string, string[]> = Object.fromEntries(
  "creep crept|spin spun|swim swam swum|run ran|fly flew flown|sing sang sung|sit sat|sleep slept|fall fell fallen|blow blew blown|dig dug|swing swung|hold held|catch caught|throw threw thrown|ride rode ridden|slide slid|shine shone|stick stuck|hide hid hidden|grow grew grown|wake woke woken|leap leapt|keep kept|sweep swept|weep wept|stand stood|take took taken|shake shook shaken|find found|draw drew drawn|drink drank drunk|eat ate eaten|give gave given|come came|see saw seen|sink sank sunk|spring sprang sprung|ring rang rung|stride strode|tear tore torn|wear wore worn|freeze froze frozen|speak spoke spoken|break broke broken|choose chose chosen|feel felt|bring brought|build built|light lit|lie lay lain|fight fought|teach taught|win won|lead led|meet met|send sent|spend spent|bend bent|feed fed|beat beat|bite bit bitten|shoot shot|hang hung|strike struck|slink slunk|cling clung|fling flung|sting stung|swell swollen|wind wound"
    .split("|")
    .flatMap((group) => {
      const forms = group.split(" ");
      return forms.map((f) => [f, forms.filter((x) => x !== f)] as const);
    }),
);

export function wordOnPage(text: string, word: string): string | null {
  const words = [...text.matchAll(/[\p{L}']+/gu)].map((m) => m[0]);
  const w = word.toLowerCase();
  // (an irregular form on the page: "creep" where it says "crept")
  const other = (IRREGULAR[w] ?? []).map((f) => words.find((x) => x.toLowerCase() === f)).find(Boolean);
  const exact = words.find((x) => x.toLowerCase() === w);
  if (exact) return word;
  // (a form that starts with it - what the reader's tap finds - keeps the
  // word as given)
  if (words.some((x) => x.toLowerCase().startsWith(w))) return word;
  // (the end of a longer word: "bee" in "bumblebee" - that word, whole)
  const whole = w.length >= 3 ? words.find((x) => x.toLowerCase().endsWith(w)) : undefined;
  if (whole) return whole;
  if (other) return other;
  // (its stem: carry / carried, hop / hopped, giggle / giggling)
  const stem = w.replace(/(ies|ied|ing|ed|es|s|e|y)$/, "");
  if (stem.length < 3) return null;
  const form = words.find((x) => x.toLowerCase().startsWith(stem) && x.length <= w.length + 4);
  return form ? form.replace(/^'+|'+$/g, "") : null;
}

const NOT_ACTIONS = new Set(["said", "asked", "called", "replied", "looked", "wanted", "needed", "seemed", "started", "decided", "thing", "something", "nothing", "everything", "morning", "evening", "during", "ceiling", "darling", "darlings", "darling's"]);
/** A word for a page whose given word isn't on it: the doing word of the
 *  target's own sentence where there is one (Coliboo "clutching" his
 *  blanket), else the first one on the page - something done, that the
 *  picture shows and a tap can act out. */
export function actionWordOf(text: string, targetName?: string): string | null {
  const sentences = text.split(/(?<=[.!?]["'\u201d]?)\s+/);
  const doing = (t: string) => [...t.matchAll(/[\p{L}]+/gu)].map((m) => m[0]).find((x) => x.length >= 5 && /(ed|ing)$/i.test(x) && !NOT_ACTIONS.has(x.toLowerCase()));
  const own = targetName ? sentences.find((t) => new RegExp(`\\b${targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t)) : undefined;
  return (own && doing(own)) || sentences.map(doing).find(Boolean) || null;
}

/** Who does the page's word, checked against its own sentence: the tap
 *  target must be the one acting it out, not a bystander. "Out tiptoed
 *  three ice monsters" had Coliboo as the target of "tiptoe", so the hop
 *  went to the baby (16 Nov). Where the target named is a character who
 *  isn't in the word's sentence (or only as an owner - "Coliboo's
 *  blanket"), and one other character is - the nearest one before the
 *  word, else after it - that one is the doer. Anything less clear is left
 *  as the storyteller gave it. */
export function doerOf(text: string, word: string, target: string, people: { id: string; name: string }[]): string {
  if (!people.some((c) => c.id === target)) return target;
  const stem = word.toLowerCase().replace(/(ing|ed|es|s)$/, "").slice(0, Math.max(3, word.length - 3)).replace(/[^\p{L}]/gu, "");
  if (!stem) return target;
  const hasWord = new RegExp(`\\b${stem}`, "iu");
  const sentence = text.split(/(?<=[.!?]["'\u201d]?)\s+/).find((t) => hasWord.test(t));
  if (!sentence) return target;
  // (the word's own clause - between commas, colons, dashes - is where its
  // doer usually is: "Tilly poured, the mice danced" - the mice)
  const clauses = sentence.split(/[,;:\u2014]|\s-\s/);
  const clause = clauses.find((t) => hasWord.test(t)) ?? sentence;
  const namesIn = (t: string) => {
    const found: { id: string; at: number }[] = [];
    for (const c of people) {
      const name = c.name.trim();
      if (!name) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?!['\u2019]s\\b)`, "gi");
      for (const m of t.matchAll(re)) found.push({ id: c.id, at: m.index ?? 0 });
    }
    return found;
  };
  const inClause = namesIn(clause);
  if (inClause.some((n) => n.id === target)) return target;
  // (turned round, the doer comes after the word: "Out tiptoed three ice
  // monsters", "Down came Bao" - the first named after it in the sentence)
  const lead = clause.trim().replace(/^["'\u201c(]+/, "").split(/\s+/);
  if (/^(out|in|up|down|off|away|over|along|round|around|there|here|through|then)$/i.test(lead[0] ?? "") && hasWord.test(lead[1] ?? "")) {
    const at = sentence.search(hasWord);
    const after = namesIn(sentence).filter((n) => n.at > at).sort((x, y) => x.at - y.at)[0];
    return after ? after.id : target;
  }
  // (a clause whose subject is "she", "they", "the mice"... - not a named
  // character - is left as the storyteller gave it: "and she curled her
  // tail round Nell and Pebble in a hug" is still the dragon's hug)
  const subject = lead.find((w) => !/^(and|but|so|then|now|soon|suddenly)$/i.test(w))?.toLowerCase() ?? "";
  if (/^(he|she|it|they|we|i|you|everyone|everybody|someone|nobody)$/.test(subject)) return target;
  if (/^(the|a|an|all|this|that|these|those|his|her|their|its|my|our)$/.test(subject) && !inClause.some((n) => n.at <= clause.indexOf(subject) + 30)) return target;
  if (inClause.length) {
    // (the nearest named before the word - its subject - else the first after:
    // "whispered Kai")
    const at = clause.search(hasWord);
    const before = inClause.filter((n) => n.at < at).sort((x, y) => y.at - x.at)[0];
    const after = inClause.filter((n) => n.at > at).sort((x, y) => x.at - y.at)[0];
    return (before ?? after)!.id;
  }
  // (a clause with a subject of its own that isn't a character - "the mice
  // danced", "he gave", "everyone came" - is left as the storyteller gave it)
  const opening = clause.trim().replace(/^["'\u201c(]+/, "").split(/\s+/)[0]?.toLowerCase() ?? "";
  if (/^(the|a|an|he|she|it|they|we|i|you|everyone|everybody|all|someone|something|nobody|this|that|these|those|his|her|their|its|my|our)$/.test(opening)) return target;
  // (a clause that carries on the sentence's own subject - "Bao snuggled
  // into the bowl, cosy and content" - is that subject's, when it is a
  // character named first in the sentence)
  const first = namesIn(sentence).sort((x, y) => x.at - y.at)[0];
  return first && first.at <= 2 && !first.id.startsWith("\u0000") ? first.id : target;
}

/** The word a page shows as its tappable word: the one it was given, as
 *  the page has it, or - where the page doesn't say it - the doing word of
 *  the target's own sentence. Null if there's none to show. */
export function shownWord(text: string, word: string | undefined, targetName?: string): string | null {
  if (!word) return null;
  const found = wordOnPage(text, word) ?? actionWordOf(text, targetName);
  if (!found) return null;
  // (exactly as the page has it - "hopped", not "hop" - so the word lit in
  // the text, the bubble over the picture and the voice all say the same)
  const w = found.toLowerCase();
  const token = [...text.matchAll(/[\p{L}']+/gu)].map((m) => m[0].replace(/^'+|'+$/g, "")).find((x) => x.toLowerCase().startsWith(w));
  return token ?? found;
}
