import { TransactionList } from "@/components/TransactionList";
import { transactionsOf } from "@/lib/transactions";

/** Dev only: the transaction history's rows - done, pending, reversed. */
export default function TxnDev() {
  if (process.env.NODE_ENV !== "development") return null;
  const t = Date.UTC(2026, 10, 16, 4, 31);
  const ledger = [
    { ref: "story:pending:c", at: t, delta: -5, reason: "hold", note: "A 8-minute story: 5 minutes beyond a free story" },
    { ref: "released:story:pending:b", at: t - 3e5, delta: 5, reason: "release", note: "thrown away" },
    { ref: "story:pending:b", at: t - 6e5, delta: -5, reason: "hold", note: "A 5-minute story" },
    { ref: "settled:story:a1", at: t - 9e7, delta: 0, reason: "spend", note: "A 5-minute story | Timmy and the Garden Treasure", of: "story:pending:a" },
    { ref: "story:pending:a", at: t - 9.1e7, delta: -5, reason: "hold", note: "A 5-minute story" },
    { ref: "settled:character:x", at: t - 1.2e8, delta: 0, reason: "spend", note: "A character, painted again | Mama" },
    { ref: "character:x", at: t - 1.21e8, delta: -3, reason: "hold", note: "A character, painted again" },
    { ref: "released:character:y", at: t - 1.3e8, delta: 3, reason: "release", note: "failed" },
    { ref: "character:y", at: t - 1.31e8, delta: -3, reason: "hold", note: "A new character" },
    { ref: "settled:character:z", at: t - 1.4e8, delta: 0, reason: "spend", note: "A new character | Dada" },
    { ref: "character:z", at: t - 1.41e8, delta: -3, reason: "hold", note: "A new character" },
    { ref: "pay:1", at: t - 2e8, delta: 50, reason: "purchase" },
  ];
  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <section className="panel credits-panel txn-panel-home">
        <TransactionList items={transactionsOf(ledger)} />
      </section>
    </main>
  );
}
