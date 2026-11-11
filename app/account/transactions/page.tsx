import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { currentAccount } from "@/server/entitlements";
import { creditBalance, creditLedger } from "@/server/billing";
import { transactionsOf } from "@/lib/transactions";
import { TransactionList } from "@/components/TransactionList";
import { CreditIcon } from "@/components/Icons";

export const metadata: Metadata = { title: "Transaction history" };

/** Plan and credits > See all transactions: every credit in and out of the
 *  account that's kept, newest first. */
export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?next=/account/transactions");
  const account = await currentAccount().catch(() => null);
  const [items, balance] = account ? await Promise.all([creditLedger(account.id, 500).then(transactionsOf, () => []), creditBalance(account.id).catch(() => null)]) : [[], null];
  return (
    <div className="container wizard txn-page">
      <header className="wizard-head">
        <p className="eyebrow">
          <Link href="/account/plans">Plan and credits</Link>
        </p>
        <h1>Transaction history</h1>
        {balance !== null && (
          <p className="sub txn-balance">
            <CreditIcon size={20} /> <b>{balance.toLocaleString("en-GB")}</b> {balance === 1 ? "credit" : "credits"} now
          </p>
        )}
      </header>
      <section className="panel txn-panel">
        {items.length ? <TransactionList items={items} /> : <p className="meta">Nothing yet. Credits you receive and spend will be listed here.</p>}
      </section>
    </div>
  );
}
