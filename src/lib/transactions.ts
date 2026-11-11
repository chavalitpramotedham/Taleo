/** One line of an account's credit history, as its owner reads it. */
export interface Transaction {
  id: string;
  at: number;
  /** "Story (5 min)", "Character", "Complimentary bonus", "Recharge"... */
  label: string;
  /** Credits in (+) or out (-). */
  amount: number;
  /** Set aside for something still being made (not yet settled). */
  pending?: boolean;
}

interface Entry {
  ref: string;
  at: number;
  delta: number;
  reason: string;
  note?: string;
}

/** What a spend was for, from the note kept with it. */
function spentOn(note: string | undefined): string {
  const story = /(\d+)-minute story/.exec(note ?? "");
  if (story) return `Story (${story[1]} min)`;
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
  const undone = new Set<string>();
  for (const e of ledger) {
    if (e.ref.startsWith("settled:")) settled.add(e.ref.slice(8));
    if (e.ref.startsWith("released:")) undone.add(e.ref.slice(9));
    if (e.ref.startsWith("refund:")) undone.add(e.ref.slice(7));
  }
  const out: Transaction[] = [];
  for (const e of ledger) {
    const line = (label: string, extra: Partial<Transaction> = {}) => out.push({ id: `${e.ref}:${e.at}`, at: e.at, label, amount: e.delta, ...extra });
    if (e.reason === "hold") {
      if (!undone.has(e.ref)) line(spentOn(e.note), { pending: !settled.has(e.ref) });
    } else if (e.reason === "spend") {
      // (a settling changes nothing more: its hold is the line. A spend
      // from before holds existed is its own line.)
      if (!e.ref.startsWith("settled:") && e.delta < 0 && !undone.has(e.ref)) line(spentOn(e.note));
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
