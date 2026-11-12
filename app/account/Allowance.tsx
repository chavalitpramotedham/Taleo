"use client";
import { STANDARD_LENGTH, STORY_LENGTHS } from "@/lib/ages";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Rights } from "@/server/rights";
import { CreditIcon, CrownMark, LeafLoader, MapleMark, OrnamentRule } from "@/components/Icons";
import { useEscape } from "@/lib/useEscape";
import { MAX_CREDITS_ADDED, monthOf, weekOf, CREDIT_PACKS, CREDIT_PACK_MAX, CREDIT_PACK_MIN, CREDIT_PRICE_CENTS, CREDIT_CURRENCY, packDiscount, packPrice } from "@/lib/tiers";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { fuzzyPeople } from "@/lib/fuzzy";
import { shortDate } from "@/lib/dates";
import Link from "next/link";
import { TransactionList } from "@/components/TransactionList";
import type { Transaction } from "@/lib/transactions";

/** How many transactions the Credits panel lists (all of them are on their own page). */
const HISTORY_SHOWN = 10;

const n = (v: number) => v.toLocaleString("en-GB");
const wait = (sec: number) => {
  const m = Math.ceil(sec / 60);
  if (m >= 36 * 60) return `${Math.round(m / 1440)} days`;
  return m >= 90 ? `about ${Math.round(m / 60)} hours` : `about ${Math.max(1, m)} minute${m === 1 ? "" : "s"}`;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "Resets Monday, 16th Nov, 12:00 am": when a count starts afresh, by the
 *  reader's own calendar and clock (the count turns at midnight in GMT+8,
 *  which is another hour elsewhere). */
const resets = (at: number) => {
  const d = new Date(at);
  const h = d.getHours();
  return `Resets ${DAYS[d.getDay()]}, ${shortDate(at)}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

type Tab = "plan" | "credits";

/** One line of a menu: the thing on the left, a row of dots, what it is
 *  (or costs) on the right. */
/** An amount of credits: the figure, then the coin. */
function Cost({ n }: { n: number | string }) {
  return (
    <span className="menu-cost">
      {n}
      <CreditIcon size={16} />
      <span className="sr-only"> credits</span>
    </span>
  );
}

function Line({ what, value, sub, note }: { what: React.ReactNode; value: React.ReactNode; /** a sub-point of the line above: indented, smaller */ sub?: boolean; /** a small grey line beneath the words */ note?: React.ReactNode }) {
  return (
    <li className={`menu-line${note ? " has-sub" : ""}${sub ? " sub-point" : ""}`}>
      <span>
        {what}
        {note && (
          <small className="menu-sub" suppressHydrationWarning>
            {note}
          </small>
        )}
      </span>
      <span className="menu-dots" aria-hidden />
      <b>{value}</b>
    </li>
  );
}

/**
 * The Plans page: at the top, the two things an account has - its plan and
 * its credits - side by side; under them one pill to switch between the
 * two, since they are separate things. "Plan" is what the plan allows
 * today and the plans themselves; "Credits" is the balance, a way to add
 * to it (the test account only) and what things cost, set out like a
 * menu. All as the server's records have it.
 */
export function PlansView({ rights: first, history = [], children }: { rights: Rights; history?: Transaction[]; children: React.ReactNode }) {
  const [rights, setRights] = useState(first);
  const always = rights.creditsMode === "always";
  // (a plan's own story is a "standard story" where longer ones add credits)
  const standard = rights.creditsMode === "auto" && rights.stories.left !== null;
  const [tab, setTab] = useState<Tab>(always ? "credits" : "plan");
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const router = useRouter();
  const s = rights.stories;
  const c = rights.characters;
  const [lo, hi] = rights.prices.story;
  const credits = rights.credits;
  return (
    <>
      {/* (the two boxes are the switch between the two: no pill as well) */}
      <section className="plans-summary" role="tablist" aria-label="Your plan and credits">
        <button type="button" role="tab" aria-selected={tab === "plan"} className={`plans-summary-item${tab === "plan" ? " on" : ""}`} onClick={() => setTab("plan")}>
          <span className="plans-summary-label">Plan</span>
          <span className="plans-summary-value">
            {rights.isAdmin ? <CrownMark /> : <MapleMark />} {rights.plan}
          </span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "credits"} className={`plans-summary-item${tab === "credits" ? " on" : ""}`} onClick={() => setTab("credits")}>
          <span className="plans-summary-label">Credits</span>
          <span className="plans-summary-value">
            {credits === null ? "-" : n(credits)} <CreditIcon size={20} />
          </span>
        </button>
      </section>
      {rights.suspended && <p className="error">This account can&apos;t make anything new at the moment. Please get in touch with us.</p>}

      {tab === "credits" ? (
        <>
        <section className="panel credits-panel" aria-label="Credits">
          <div className="credits-head">
            <p className="credits-amount">
              <CreditIcon size={30} />
              <b>{credits === null ? "-" : n(credits)}</b>
              <span>{credits === 1 ? "credit" : "credits"}</span>
            </p>
            {/* (the admin's test account adds credits by hand; everyone else buys them) */}
            {(
              <button type="button" className="btn btn-primary credits-add" onClick={() => (rights.canAddCredits ? setAdding(true) : setBuying(true))} aria-label={rights.canAddCredits ? "Add credits" : "Buy credits"} title={rights.canAddCredits ? "Add credits" : "Buy credits"}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          {rights.reserved > 0 && (
            <p className="meta credits-reserved">
              <b>{n(rights.reserved)}</b> more set aside for what&apos;s being made right now. {rights.reserved === 1 ? "It comes" : "They come"} back if it doesn&apos;t work out.
            </p>
          )}
          {credits === null ? (
            <p className="meta">Credits aren&apos;t available here yet.</p>
          ) : (
            <p className="meta">
              {always ? "Every story and character on this account uses credits." : "Your plan's free stories and characters go first. Credits pay for more once they're used up."}
            </p>
          )}
          {/* the price list, set apart in its own dotted frame: it's what
              things cost, not what this account has spent */}
          <div className="price-card">
            <h4 className="menu-title">What things cost</h4>
            <ul className="menu-list">
              <Line what="Reading, and the whole library" value="Free" />
              <Line what="A character, new or repainted" value={<Cost n={rights.prices.character} />} />
              <Line what="A new story, by its length*" value={<Cost n={`${lo}–${hi}`} />} />
              {/* (the three lengths) */}
              {STORY_LENGTHS.map((l) => (
                <Line
                  key={l.id}
                  sub
                  what={
                    <>
                      <b>{l.name}</b>: {l.time} min, {l.decisions} decisions
                    </>
                  }
                  value={<Cost n={l.minutes} />}
                />
              ))}
            </ul>
            <p className="meta menu-note">*NOTE: a story&apos;s credits are set aside when it begins and spent at its first choice. One dropped before that gets them back.</p>
          </div>

        </section>
        {/* what the credits were spent on, and when more arrived: a section
            of its own, under a line across with its name on it - as the
            plans are, under the quota */}
        <div className="txn-section">
          <OrnamentRule className="home-divider plans-rule" />
          <header className="home-shelf-head plans-head">
            <h2>Transaction history</h2>
          </header>
          <section className="panel credits-panel txn-panel-home" aria-label="Transaction history">
            {history.length === 0 ? (
              <p className="meta menu-note">Nothing yet. Credits you receive and spend will be listed here.</p>
            ) : (
              <>
                {/* (the ten newest; the rest are on their own page) */}
                <TransactionList items={history.slice(0, HISTORY_SHOWN)} />
                <p className="txn-more">
                  <Link className="txn-all" href="/account/transactions">
                    See all transactions
                  </Link>
                </p>
              </>
            )}
          </section>
        </div>
        </>
      ) : (
        <>
          {!always && (
            <section className="panel credits-panel" aria-label="What your plan allows right now">
              <h4 className="menu-title">Your quota</h4>
              <ul className="menu-list">
                <Line what={`${standard ? "Standard stories" : "Stories"} left${s.weekly ? " this week" : s.windowHours === 24 ? " today" : ""}${standard ? "*" : ""}`} value={s.left === null ? "Unlimited" : n(s.left)} note={s.left !== null && s.weekly ? resets(weekOf(Date.now()).end) : undefined} />
                <Line
                  what={`Characters left${c.designsPer ? ` this ${c.designsPer}` : ""}`}
                  value={c.designsLeft === null ? "Unlimited" : n(c.designsLeft)}
                  note={c.designsLeft !== null && c.designsPer ? resets((c.designsPer === "month" ? monthOf : weekOf)(Date.now()).end) : undefined}
                />
                <Line what="Custom character slots used" value={c.limit === null ? n(c.saved) : `${n(c.saved)} of ${n(c.limit)}`} />
              </ul>
              {standard && (
                <p className="meta menu-note">
                  *NOTE: a standard story is a Quest or an Adventure. An Odyssey uses one too, and adds {STORY_LENGTHS[2].minutes - STANDARD_LENGTH.minutes} credits.
                </p>
              )}
            </section>
          )}
          {children}
        </>
      )}

      {buying && <BuyCredits balance={credits ?? 0} onClose={() => setBuying(false)} />}
      {adding && (
        <AddCredits
          balance={credits ?? 0}
          onClose={() => setAdding(false)}
          onAdded={(now) => {
            setRights({ ...rights, credits: now });
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

const QUICK = [5, 10, 20, 50];

type Person = { id: string; username: string | null; email: string };
const called = (p: Person) => (p.username ? `@${p.username}` : p.email);
const lost = (e: unknown, fallback: string) => (e instanceof TypeError ? "No connection - check your internet and try again." : e instanceof Error ? e.message : fallback);

/** "Add credits" (the admin only): a number, or one of a few quick
 *  amounts, for the admin's own account or for someone found by handle or
 *  email. Digits only - anything else can't be typed or pasted in. How it
 *  went is said in a toast at the top of the screen. */
/**
 * Buying credits: choose a pack (or another amount), see what it comes to,
 * and go on to the card checkout.
 *
 * The price isn't decided and the checkout isn't open: the price reads "to
 * be announced", and going on says plainly that payments are still being
 * set up - nothing charged, nothing added. Both are kept in one place each
 * (lib/tiers: packPrice; /api/account/checkout) for when they're ready.
 */
function BuyCredits({ balance, onClose }: { balance: number; onClose: () => void }) {
  const [pack, setPack] = useState<number | "other">(CREDIT_PACKS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // (after "Continue to checkout": what the checkout said)
  const [answer, setAnswer] = useState<string | null>(null);
  useEscape(onClose, !busy);
  const amount = pack === "other" ? (/^[0-9]+$/.test(text) ? Number(text) : 0) : pack;
  const valid = amount >= CREDIT_PACK_MIN && amount <= CREDIT_PACK_MAX;
  const cost = (credits: number) => {
    const p = packPrice(credits);
    // ("US$5.00": said with its country, as dollars are not everyone's own)
    return p ? new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currency, currencyDisplay: "symbol" }).format(p.amount) : null;
  };
  const total = valid ? cost(amount) : null;
  const priced = valid ? packPrice(amount) : null;
  const money = (v: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: CREDIT_CURRENCY }).format(v);
  const perCredit = new Intl.NumberFormat("en-GB", { style: "currency", currency: CREDIT_CURRENCY }).format(CREDIT_PRICE_CENTS / 100);
  const checkout = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credits: amount }) });
      const data = (await res.json().catch(() => ({}))) as { url?: string; pending?: boolean; message?: string; error?: string };
      // (when the checkout is open, it sends where to pay: go there)
      if (res.ok && data.url) return void (window.location.href = data.url);
      if (data.pending) return setAnswer(data.message || "Card payments are still being set up. Nothing has been charged.");
      throw new Error(data.error || "The checkout couldn't be opened. Please try again.");
    } catch (e) {
      setError(lost(e, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form
        className="modal-panel draft-prompt add-credits buy-credits"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void checkout();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Buy credits"
      >
        <div className="modal-head">
          <h3>
            <CreditIcon size={22} /> Buy credits
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            ✕
          </button>
        </div>
        {answer ? (
          <>
            <section className="add-credits-box">
              <h4 className="menu-title">Checkout isn&apos;t open yet</h4>
              <p className="limit-message buy-credits-answer">{answer}</p>
              <p className="meta">
                You chose {n(amount)} credit{amount === 1 ? "" : "s"}. When payments open, this step will take you to Stripe&apos;s checkout page to pay by card.
              </p>
            </section>
            <PaymentSafety />
            <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <section className="add-credits-box" aria-labelledby="buy-credits-pack">
              <h4 id="buy-credits-pack" className="menu-title">
                Choose a pack
              </h4>
              <div className="buy-credits-packs" role="radiogroup" aria-label="Credit packs">
                {CREDIT_PACKS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={pack === c} className={`buy-credits-pack${pack === c ? " on" : ""}${packDiscount(c) > 0 ? " deal" : ""}`} onClick={() => setPack(c)} disabled={busy}>
                    <span className="buy-credits-n">
                      {n(c)}
                      <CreditIcon size={16} />
                    </span>
                    {/* (a discounted pack: a green badge on its corner, and
                        the full price struck through beside what's paid) */}
                    {packDiscount(c) > 0 && <span className="buy-credits-off">{packDiscount(c)}% off</span>}
                    <span className="buy-credits-price">
                      {packDiscount(c) > 0 && (
                        <>
                          <s>
                            <span className="sr-only">was </span>
                            {money(packPrice(c)!.full)}
                          </s>{" "}
                        </>
                      )}
                      <b>{cost(c) ?? "Price to come"}</b>
                    </span>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={pack === "other"} className={`buy-credits-pack${pack === "other" ? " on" : ""}`} onClick={() => setPack("other")} disabled={busy}>
                  <span className="buy-credits-n">Other</span>
                  <span className="buy-credits-price">Your own amount, {n(CREDIT_PACK_MIN)} or more</span>
                </button>
              </div>
              {pack === "other" && (
                <>
                  <input
                    className="input add-credits-number"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={3}
                    value={text}
                    onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 3))}
                    placeholder="How many?"
                    aria-label="How many credits to buy"
                  />
                  {text !== "" && !valid && (
                    <p className="error">
                      Enter a whole number from {n(CREDIT_PACK_MIN)} to {n(CREDIT_PACK_MAX)}.
                    </p>
                  )}
                </>
              )}
            </section>
            <section className="add-credits-box" aria-label="What it comes to">
              <ul className="menu-list">
                <Line what="Credits" value={valid ? <Cost n={n(amount)} /> : "-"} />
                {/* (a discount is shown as its own line: the full price, what comes off, what's paid) */}
                {valid && priced && priced.off > 0 ? (
                  <>
                    <Line what={`${perCredit} a credit`} value={money(priced.full)} />
                    <Line what={`Discount (${priced.off}% on ${n(priced.off >= 10 ? 100 : 50)} credits or more)`} value={`−${money(priced.full - priced.amount)}`} />
                    <Line what="Price" value={total ?? "-"} />
                  </>
                ) : (
                  <Line what={`Price (${perCredit} a credit)`} value={total ?? "-"} />
                )}
                <Line what="Your credits after" value={valid ? <Cost n={n(balance + amount)} /> : "-"} />
              </ul>
            </section>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
              {busy ? (
                <>
                  <LeafLoader size={16} /> Opening the checkout…
                </>
              ) : (
                "Continue to checkout"
              )}
            </button>
            <p className="meta buy-credits-foot">5% off orders of 50 credits or more, 10% off 100 or more.</p>
            <PaymentSafety />
          </>
        )}
      </form>
    </div>
  );
}

/**
 * How paying is kept safe, said plainly. Every line here must be true of
 * the checkout as it is built (see /api/account/checkout): Stripe's own
 * hosted page takes the card, this app never sees or keeps card details,
 * and credits are added only on Stripe's confirmation. Until payments are
 * open it says so first - nothing can be charged from here today.
 */
function PaymentSafety() {
  return (
    <section className="add-credits-box buy-credits-safety" aria-labelledby="buy-credits-safety">
      <h4 id="buy-credits-safety" className="menu-title">
        Paying safely
      </h4>
      <ul>
        <li>
          <b>Not open yet.</b> Card payments are still being set up, so nothing can be charged from here today.
        </li>
        <li>
          <b>Paid on Stripe&apos;s page.</b> When payments open, you&apos;ll enter your card on Stripe&apos;s own secure checkout page, not on Taleo.
        </li>
        <li>
          <b>We never see your card.</b> Your card number goes straight to Stripe. Taleo doesn&apos;t receive it or store it.
        </li>
        <li>
          <b>You confirm the total first.</b> Stripe shows the amount before you pay, and nothing is charged until you confirm there.
        </li>
        <li>
          <b>Credits follow the payment.</b> Credits are added to your account only once Stripe tells us the payment went through.
        </li>
      </ul>
    </section>
  );
}

function AddCredits({ balance, onClose, onAdded }: { balance: number; onClose: () => void; onAdded: (credits: number) => void }) {
  const toast = useToast();
  const me = useSession().data?.user?.username ?? null;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // who the credits are for
  const [whom, setWhom] = useState<"me" | "someone">("me");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [typed, setTyped] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [theirs, setTheirs] = useState<number | null>(null);
  useEscape(onClose, !busy);
  // The accounts to search, fetched the first time "someone else" is chosen.
  useEffect(() => {
    if (whom !== "someone" || people) return;
    let here = true;
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ people: Person[] }>) : Promise.reject(new Error("The accounts couldn't be listed."))))
      .then((d) => here && setPeople(d.people))
      .catch((e) => here && setError(lost(e, "The accounts couldn't be listed.")));
    return () => {
      here = false;
    };
  }, [whom, people]);
  // The chosen account's balance, to show beside its name.
  useEffect(() => {
    if (!person) return;
    let here = true;
    fetch(`/api/admin/credits?user=${encodeURIComponent(person.id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ credits: number | null }>) : null))
      .then((d) => here && setTheirs(d?.credits ?? null))
      .catch(() => {});
    return () => {
      here = false;
    };
  }, [person]);
  const found = useMemo(() => (people && typed.trim() ? fuzzyPeople(typed, people).slice(0, 6) : []), [people, typed]);
  const amount = /^[0-9]+$/.test(text) ? Number(text) : 0;
  const valid = amount >= 1 && amount <= MAX_CREDITS_ADDED && (whom === "me" || person !== null);
  const add = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const many = `${n(amount)} credit${amount === 1 ? "" : "s"}`;
    try {
      const res =
        whom === "me"
          ? await fetch("/api/account/credits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: String(amount) }) })
          : await fetch("/api/admin/credits", {
              method: "POST",
              headers: { "content-type": "application/json" },
              // (its own reference: sent twice by a flaky connection, it's added once)
              body: JSON.stringify({ user: person!.id, credits: amount, ref: `plans-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, note: "Given from Plan and credits" }),
            });
      const data = (await res.json().catch(() => ({}))) as { credits?: number; error?: string };
      if (!res.ok || typeof data.credits !== "number") throw new Error(data.error || "The credits couldn't be added. Please try again.");
      if (whom === "me") {
        toast(`${many} added to your account`);
        onAdded(data.credits);
      } else {
        toast(`${many} added for ${called(person!)}`);
        onClose();
      }
    } catch (e) {
      const why = lost(e, "Something went wrong.");
      setError(why);
      toast(why, "error");
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form
        className="modal-panel draft-prompt add-credits"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Add credits"
      >
        <div className="modal-head">
          <h3>
            <CreditIcon size={22} /> Add credits
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            ✕
          </button>
        </div>
        <Segmented
          label="Whose account the credits go to"
          className="add-credits-whom"
          options={[
            { key: "me", label: "My account" },
            { key: "someone", label: "Another user" },
          ]}
          value={whom}
          onChange={(k) => {
            setWhom(k);
            setError(null);
          }}
        />

        {/* who they're for: you (said plainly), or someone to find */}
        <section className="add-credits-box" aria-labelledby="add-credits-who">
          <h4 id="add-credits-who" className="menu-title">
            For who?
          </h4>
          {whom === "me" ? (
            <p className="add-credits-person">
              <span>
                <b>{me ? `@${me}` : "Your account"}</b>
                <span className="meta">
                  {n(balance)} credit{balance === 1 ? "" : "s"} now
                </span>
              </span>
            </p>
          ) : person ? (
            <p className="add-credits-person">
              <span>
                <b>{called(person)}</b>
                <span className="meta">
                  {person.username ? `${person.email} · ` : ""}
                  {theirs === null ? "…" : `${n(theirs)} credit${theirs === 1 ? "" : "s"} now`}
                </span>
              </span>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setPerson(null);
                  setTheirs(null);
                }}
                disabled={busy}
              >
                Change
              </button>
            </p>
          ) : (
            <div className="add-credits-find">
              <input
                className="input add-credits-search"
                type="text"
                inputMode="search"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Handle or email"
                aria-label="Find a user by handle or email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {typed.trim() !== "" &&
                (people === null ? (
                  <p className="meta">Finding accounts…</p>
                ) : found.length === 0 ? (
                  <p className="meta">Nobody like “{typed.trim()}”.</p>
                ) : (
                  <ul className="add-credits-found" role="listbox" aria-label="Accounts it could be">
                    {found.map((p) => (
                      <li key={p.id}>
                        <button type="button" role="option" aria-selected={false} onClick={() => setPerson(p)}>
                          <b>{called(p)}</b>
                          {p.username && <span className="meta">{p.email}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          )}
        </section>

        {/* how many: a number to type, or one of a few to tap */}
        <section className="add-credits-box" aria-labelledby="add-credits-amount">
          <h4 id="add-credits-amount" className="menu-title">
            Amount
          </h4>
          <input
            className="input add-credits-number"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={4}
            value={text}
            // (digits only, whatever is typed or pasted)
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 4))}
            placeholder="How many?"
            aria-label="How many credits to add"
          />
          <div className="add-credits-quick" role="group" aria-label="Quick amounts">
            {QUICK.map((q) => (
              <button key={q} type="button" className={`chip${amount === q ? " on" : ""}`} onClick={() => setText(String(q))} disabled={busy}>
                +{q}
              </button>
            ))}
          </div>
          {text !== "" && !(amount >= 1 && amount <= MAX_CREDITS_ADDED) && <p className="error">Enter a whole number from 1 to {n(MAX_CREDITS_ADDED)}.</p>}
        </section>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
          {busy ? (
            <>
              <LeafLoader size={16} /> Adding…
            </>
          ) : valid ? (
            `Add ${n(amount)} credit${amount === 1 ? "" : "s"}${whom === "someone" && person ? ` for ${called(person)}` : ""}`
          ) : (
            "Add credits"
          )}
        </button>
      </form>
    </div>
  );
}
