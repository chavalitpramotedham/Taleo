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
 * each with a rule between - what it was and when on the left, the credits
 * in or out (with the coin) on the right. Newest first, as given.
 */
export function TransactionList({ items }: { items: Transaction[] }) {
  return (
    <ul className="txn-list">
      {items.map((t) => (
        <li key={t.id} className="txn">
          <span className="txn-what">
            <b>{t.label}</b>
            <small suppressHydrationWarning>
              {shortDate(t.at)}, {clock(t.at)}
              {t.pending ? " · being made" : ""}
            </small>
          </span>
          <span className={`txn-amount ${t.amount > 0 ? "in" : "out"}`} aria-label={`${t.amount > 0 ? "plus" : "minus"} ${n(Math.abs(t.amount))} credits`}>
            {t.amount > 0 ? "+" : "−"}
            <CreditIcon size={18} />
            {n(Math.abs(t.amount))}
          </span>
        </li>
      ))}
    </ul>
  );
}
