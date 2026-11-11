"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Rights } from "@/server/rights";
import { CreditIcon, CrownMark, LeafLoader, MapleMark } from "@/components/Icons";
import { useEscape } from "@/lib/useEscape";
import { MAX_CREDITS_ADDED } from "@/lib/tiers";

const n = (v: number) => v.toLocaleString("en-GB");
const wait = (sec: number) => {
  const m = Math.ceil(sec / 60);
  return m >= 90 ? `about ${Math.round(m / 60)} hours` : `about ${Math.max(1, m)} minute${m === 1 ? "" : "s"}`;
};

type Tab = "plan" | "credits";

/** One line of a menu: the thing on the left, a row of dots, what it is
 *  (or costs) on the right. */
function Line({ what, value }: { what: React.ReactNode; value: React.ReactNode }) {
  return (
    <li className="menu-line">
      <span>{what}</span>
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
export function PlansView({ rights: first, children }: { rights: Rights; children: React.ReactNode }) {
  const [rights, setRights] = useState(first);
  const always = rights.creditsMode === "always";
  const [tab, setTab] = useState<Tab>(always ? "credits" : "plan");
  const [adding, setAdding] = useState(false);
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
            <CreditIcon size={20} /> {credits === null ? "-" : n(credits)}
          </span>
        </button>
      </section>
      {rights.suspended && <p className="error">This account can&apos;t make anything new at the moment. Please get in touch with us.</p>}

      {tab === "credits" ? (
        <section className="panel credits-panel" aria-label="Credits">
          <div className="credits-head">
            <p className="credits-amount">
              <CreditIcon size={30} />
              <b>{credits === null ? "-" : n(credits)}</b>
              <span>{credits === 1 ? "credit" : "credits"}</span>
            </p>
            {rights.canAddCredits && (
              <button type="button" className="btn btn-primary credits-add" onClick={() => setAdding(true)} aria-label="Add credits" title="Add credits">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          {credits === null ? (
            <p className="meta">Credits aren&apos;t available here yet.</p>
          ) : (
            <p className="meta">
              {always ? "Every story and character on this account uses credits." : "Your plan's free stories and characters go first. Credits pay for more once they're used up."}
            </p>
          )}
          <h4 className="menu-title">What things cost</h4>
          <ul className="menu-list">
            <Line what="A story, for each minute" value={1} />
            <Line what={`The shortest story (${lo} minutes)`} value={lo} />
            <Line what={`The longest story (${hi} minutes)`} value={hi} />
            <Line what="A character, new or repainted" value={rights.prices.character} />
            <Line what="Reading, and the whole library" value="Free" />
          </ul>
          <p className="meta menu-note">A story is charged once, at its first choice. One dropped before that costs nothing.</p>
        </section>
      ) : (
        <>
          {!always && (
            <section className="panel credits-panel" aria-label="What your plan allows right now">
              <h4 className="menu-title">Free on your plan{s.windowHours === 24 ? " today" : ""}</h4>
              <ul className="menu-list">
                <Line what="Free stories left" value={s.left === null ? "Unlimited" : n(s.left)} />
                {/* (where credits pay for more, a count of free beginnings would only confuse) */}
                {rights.creditsMode === "beyond" && <Line what="Stories you can begin" value={s.startsLeft === null ? "Unlimited" : n(s.startsLeft)} />}
                <Line what="Characters kept" value={c.limit === null ? n(c.saved) : `${n(c.saved)} of ${n(c.limit)}`} />
                <Line what="Free character designs left" value={c.designsLeft === null ? "Unlimited" : n(c.designsLeft)} />
              </ul>
              {s.left === 0 && s.nextInSec > 0 && (
                <p className="meta menu-note">
                  The next free story comes back in {wait(s.nextInSec)}.{credits ? " Until then, stories use credits." : ""}
                </p>
              )}
            </section>
          )}
          {children}
        </>
      )}

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

/** "Add credits" (the test account only): a number, or one of a few quick
 *  amounts. Digits only - anything else can't be typed or pasted in. */
function AddCredits({ balance, onClose, onAdded }: { balance: number; onClose: () => void; onAdded: (credits: number) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose, !busy);
  const amount = /^[0-9]+$/.test(text) ? Number(text) : 0;
  const valid = amount >= 1 && amount <= MAX_CREDITS_ADDED;
  const add = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/credits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: String(amount) }) });
      const data = (await res.json().catch(() => ({}))) as { credits?: number; error?: string };
      if (!res.ok || typeof data.credits !== "number") throw new Error(data.error || "The credits couldn't be added. Please try again.");
      onAdded(data.credits);
    } catch (e) {
      setError(e instanceof TypeError ? "No connection - check your internet and try again." : e instanceof Error ? e.message : "Something went wrong.");
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
        <p className="meta">
          You have <b>{n(balance)}</b>. These are added to your own account only.
        </p>
        <div className="add-credits-quick" role="group" aria-label="Quick amounts">
          {QUICK.map((q) => (
            <button key={q} type="button" className={`chip${amount === q ? " on" : ""}`} onClick={() => setText(String(q))} disabled={busy}>
              +{q}
            </button>
          ))}
        </div>
        <input
          className="input"
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
          autoFocus
        />
        {text !== "" && !valid && <p className="error">Enter a whole number from 1 to {n(MAX_CREDITS_ADDED)}.</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
          {busy ? (
            <>
              <LeafLoader size={16} /> Adding…
            </>
          ) : valid ? (
            `Add ${n(amount)} credit${amount === 1 ? "" : "s"}`
          ) : (
            "Add credits"
          )}
        </button>
      </form>
    </div>
  );
}
