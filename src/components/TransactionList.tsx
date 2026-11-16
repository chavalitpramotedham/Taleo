"use client";
import { CreditIcon } from "./Icons";
import { shortDate } from "@/lib/dates";
import type { Transaction } from "@/lib/transactions";

const n = (v: number) => v.toLocaleString("en-GB");
/** "9:41 pm", by the reader's own clock. */
const clock = (at: number) => {
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/**
 * An account's credit transactions, set out as a bank lists them: one row
 * each with a rule between - what it was, and when, on the left (with its
 * status if it isn't simply done: pending, or reversed - its credits given
 * back, the figure struck through), the credits in or out on the right,
 * the coin after the figure. Newest first, as given.
 */
export function TransactionList({ items }: { items: Transaction[] }) {
  return (
    <ul className="txn-list">
      {items.map((t) => {
        const status = t.reversed ? "reversed" : t.pending ? "pending" : null;
        return (
          <li key={t.id} className={`txn${status ? ` txn-${status}` : ""}`}>
            <span className="txn-what">
              <b>{t.label}</b>
              {/* (what kind of thing: "Story • Odyssey", "Character • New") */}
              {t.kind && <span className="txn-kind">{t.kind}</span>}
              <small suppressHydrationWarning>
                {shortDate(t.at)}, {clock(t.at)}
              </small>
            </span>
            {/* (the credits, and under them its status only while it isn't simply done) */}
            <span className="txn-side">
            <span
              className={`txn-amount ${t.amount > 0 ? "in" : "out"}${t.reversed ? " struck" : ""}`}
              aria-label={`${t.amount > 0 ? "plus" : "minus"} ${n(Math.abs(t.amount))} credits${t.reversed ? ", reversed" : t.pending ? ", pending" : ""}`}
            >
              <span className="txn-figure">
                {t.amount > 0 ? "+" : "−"}
                {n(Math.abs(t.amount))}
              </span>
              <CreditIcon size={18} />
            </span>
            {status && <span className={`txn-status ${status}`}>{status === "pending" ? "Pending" : "Reversed"}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
