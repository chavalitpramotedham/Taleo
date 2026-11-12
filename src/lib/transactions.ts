import { lengthOf } from "./ages";
/** One line of an account's credit history, as its owner reads it. */
export interface Transaction {
  id: string;
  at: number;
  /** The name of the character or story made (or "Story (5 min)" /
   *  "Character" while it has none), "Complimentary bonus", "Recharge"... */
  label: string;
  /** Credits in (+) or out (-). */
  amount: number;
  /** Set aside for something still being made (not yet settled). */
  pending?: boolean;
  /** A few words more, under the title: how a story was paid for when
   *  part of it was the plan's free story ("Free 5 min + 1 min"). */
  detail?: string;
}

interface Entry {
  ref: string;
  at: number;
  delta: number;
  reason: string;
  note?: string;
  /** on a settling or a release: the name the hold was first made under */
  of?: string;
  /** on a settling or a release: the credits concerned */
  amount?: number;
  /** how many of them were the plan's weekly credits */
  weekly?: number;
}

/** How something was paid for, when it wasn't simply bought credits:
 *  "1 free Quest + 2 weekly credits", "1 weekly credit + 4 credits". */
function paidWith(e: Entry): string {
  const parts: string[] = [];
  if (/beyond a free story/.test(e.note ?? "")) parts.push("1 free Quest");
  const w = e.weekly ?? 0;
  const b = -e.delta;
  if (w) parts.push(`${w} weekly credit${w === 1 ? "" : "s"}`);
  if (w && b > 0) parts.push(`${b} credit${b === 1 ? "" : "s"}`);
  if (parts.length === 1 && parts[0] === "1 free Quest" && b > 0) parts.push(`${b} credit${b === 1 ? "" : "s"}`);
  return parts.length > 1 || w ? parts.join(" + ") : "";
}

/** A story that was partly the plan's free story and partly credits
 *  ("A 6-minute story: 1 minute beyond a free story"): "Free 5 min + 1 min". */
function mixed(note: string | undefined): string {
  const m = /(\d+)-minute story: (\d+) minutes? beyond/.exec(note ?? "");
  return m ? `Free story + ${m[2]} credit${m[2] === "1" ? "" : "s"}` : "";
}

/** What a spend was for, from the note kept with it. */
function spentOn(note: string | undefined): string {
  const story = /(\d+)-minute story/.exec(note ?? "");
  const split = mixed(note);
  if (story && split) return `${lengthOf(Number(story[1])).name} (${split})`;
  if (story) return `${lengthOf(Number(story[1])).name} story`;
  if (/character/i.test(note ?? "")) return "Character";
  return "Story or character";
}

/**
 * The ledger (every step, newest first) as a history a person can read:
 * one line for each thing bought and each time credits arrived. A hold
 * and its settling are one line; something that failed, and had its
 * credits returned, isn't shown at all - nothing was spent.
 */
export function transactionsOf(ledger: Entry[]): Transaction[] {
  const settled = new Set<string>();
  // (the name of what was made, told when it was settled: "... | Pip")
  const named = new Map<string, string>();
  const nameIn = (note: string | undefined) => {
    const i = (note ?? "").indexOf(" | ");
    return i < 0 ? "" : note!.slice(i + 3).trim();
  };
  const undone = new Set<string>();
  const holds = new Set(ledger.filter((e) => e.reason === "hold").map((e) => e.ref));
  // (a story's credits are held under one name when it's begun and
  // settled under the story's own: the ledger says which hold that was -
  // `of` - and for the few from before it did, it's the nearest earlier
  // hold for a story of the same amount that nothing else ended)
  const claimed = new Set<string>();
  const holdOf = (e: Entry, ended: string): string => {
    if (e.of) return e.of;
    if (holds.has(ended) || !ended.startsWith("story:")) return ended;
    const earlier = ledger.find((h) => h.reason === "hold" && h.at <= e.at && h.ref.startsWith("story:pending:") && !claimed.has(h.ref) && (!e.amount || -h.delta === e.amount) && !ledger.some((x) => (x.ref === `settled:${h.ref}` || x.ref === `released:${h.ref}`) || x.of === h.ref));
    return earlier ? earlier.ref : ended;
  };
  for (const e of ledger) {
    if (e.ref.startsWith("settled:")) {
      const hold = holdOf(e, e.ref.slice(8));
      claimed.add(hold);
      settled.add(hold);
      const name = nameIn(e.note);
      if (name) named.set(hold, name);
    }
    if (e.ref.startsWith("released:")) {
      const hold = holdOf(e, e.ref.slice(9));
      claimed.add(hold);
      undone.add(hold);
    }
    if (e.ref.startsWith("refund:")) undone.add(e.ref.slice(7));
  }
  const out: Transaction[] = [];
  for (const e of ledger) {
    const line = (label: string, extra: Partial<Transaction> = {}) => out.push({ id: `${e.ref}:${e.at}`, at: e.at, label, amount: e.delta, ...extra });
    if (e.reason === "hold") {
      // (titled with the character's or the story's own name once it's made)
      // (under a story's name, how it was paid for if part of it was free)
      if (!undone.has(e.ref)) line(named.get(e.ref) || spentOn(e.note), { amount: e.delta - (e.weekly ?? 0), pending: !settled.has(e.ref), detail: paidWith(e) || (named.has(e.ref) ? mixed(e.note) || undefined : undefined) });
    } else if (e.reason === "spend") {
      // (a settling changes nothing more: its hold is the line. A spend
      // from before holds existed is its own line.)
      if (!e.ref.startsWith("settled:") && e.delta < 0 && !undone.has(e.ref)) line(nameIn(e.note) || spentOn(e.note));
    } else if (e.reason === "release" || e.reason === "refund") {
      // (the other half of something that came to nothing)
    } else if (e.reason === "purchase" || (e.reason === "grant" && e.ref.startsWith("self:"))) {
      line("Recharge");
    } else if (e.reason === "grant" || (e.reason === "adjust" && e.delta > 0)) {
      line("Complimentary bonus");
    } else if (e.reason === "adjust") {
      line("Adjustment");
    }
  }
  return out;
}
