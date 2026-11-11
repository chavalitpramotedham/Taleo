"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Rights } from "@/server/rights";
import { CreditIcon, LeafLoader } from "@/components/Icons";
import { useEscape } from "@/lib/useEscape";
import { MAX_CREDITS_ADDED } from "@/lib/tiers";

const n = (v: number) => v.toLocaleString("en-GB");
const hours = (h: number | null) => (h === 24 ? "today" : h ? `in this ${h}-hour stretch` : "");
const wait = (sec: number) => {
  const m = Math.ceil(sec / 60);
  return m >= 90 ? `about ${Math.round(m / 60)} hours` : `about ${Math.max(1, m)} minute${m === 1 ? "" : "s"}`;
};

/**
 * What this account can do right now (Plans, above the plans themselves):
 * stories that can still be finished and begun, characters, credits and
 * what they buy - as the server's records have it. The admin's test
 * account can add credits to itself from here.
 */
export function Allowance({ rights: first }: { rights: Rights }) {
  const [rights, setRights] = useState(first);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const always = rights.creditsMode === "always";
  const s = rights.stories;
  const c = rights.characters;
  const [lo, hi] = rights.prices.story;
  return (
    <section className="panel allowance" aria-label="What you can do right now">
      <div className="tier-summary-head">
        <h3>What you can do right now</h3>
        {rights.canAddCredits && (
          <button type="button" className="btn btn-primary tier-manage" onClick={() => setAdding(true)}>
            Add credits
          </button>
        )}
      </div>
      {rights.suspended && <p className="error">This account can&apos;t make anything new at the moment. Please get in touch with us.</p>}
      <dl className="allowance-grid">
        <div>
          <dt>Stories to finish</dt>
          <dd>{always ? "With credits" : s.left === null ? "Unlimited" : n(s.left)}</dd>
          <p className="meta">
            {always
              ? `Each story uses a credit a minute: ${lo} to ${hi}.`
              : s.left === null
                ? "No limit on this plan."
                : s.left > 0
                  ? `New stories left ${hours(s.windowHours)}. A story counts once you make its first choice.`
                  : `The next one opens up in ${wait(s.nextInSec)}.`}
          </p>
        </div>
        <div>
          <dt>Stories to begin</dt>
          <dd>{always ? "With credits" : s.startsLeft === null ? "Unlimited" : n(s.startsLeft)}</dd>
          <p className="meta">{always ? "A story begun and dropped before its first choice costs nothing." : "Beginnings, including ones dropped before the first choice."}</p>
        </div>
        <div>
          <dt>Characters kept</dt>
          <dd>{c.limit === null ? n(c.saved) : `${n(c.saved)} of ${n(c.limit)}`}</dd>
          <p className="meta">
            {always
              ? `Designing or repainting one uses ${rights.prices.character} credit.`
              : c.designsLeft === null
                ? "No limit on designs."
                : `${n(c.designsLeft)} design${c.designsLeft === 1 ? "" : "s"} or repaint${c.designsLeft === 1 ? "" : "s"} left today.`}
          </p>
        </div>
        <div>
          <dt>
            <CreditIcon size={16} /> Credits
          </dt>
          <dd>{rights.credits === null ? "-" : n(rights.credits)}</dd>
          <p className="meta">
            {rights.credits === null
              ? "Credits aren't available here yet."
              : always
                ? `Enough for ${n(Math.floor(rights.credits / hi))} to ${n(Math.floor(rights.credits / lo))} stories.`
                : `One credit is a minute of story (${lo} to ${hi} a story) or one character, once the plan's own are used up.`}
          </p>
        </div>
      </dl>
      {adding && (
        <AddCredits
          balance={rights.credits ?? 0}
          onClose={() => setAdding(false)}
          onAdded={(credits) => {
            setRights({ ...rights, credits });
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </section>
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
