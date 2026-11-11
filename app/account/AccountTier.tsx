"use client";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { CrownMark, MapleMark } from "@/components/Icons";
import { PLANS, tierCaps, tierFor, tierRows, type TierId, type TierInfo, type TierRow } from "@/lib/tiers";

/** A small sprouting seedling - the plans still to come. */
const SeedlingMark = () => (
  <svg className="seedling-mark" viewBox="0 0 32 32" aria-hidden focusable="false">
    <path d="M16 29 V15" stroke="#6F7F52" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <path d="M16 18 C10 18 6.5 14 6 8.5 C11.5 8.6 15.6 12 16 18 Z" fill="#94A270" stroke="#4F5A35" strokeWidth="0.9" strokeLinejoin="round" />
    <path d="M16 15 C17 9.5 21 5.6 26.5 5.4 C26.3 11 22.4 14.8 16 15 Z" fill="#AAB585" stroke="#4F5A35" strokeWidth="0.9" strokeLinejoin="round" />
    <path d="M10 26 C12 25 20 25 22 26" stroke="#A98463" strokeWidth="1.4" strokeLinecap="round" fill="none" />
  </svg>
);

type Card = {
  key: string;
  icon: React.ReactNode;
  name: string;
  tagline: string;
  price: string;
  button: string;
  current: boolean;
  intro: string;
  features: string[];
  caps?: TierRow[];
};

const fromTier = (t: TierInfo, current: boolean): Card => ({
  key: t.id,
  icon: t.id === "admin" ? <CrownMark /> : <MapleMark />,
  name: t.name,
  tagline: t.blurb,
  // (the plan everyone has costs nothing, whatever it's called)
  price: t.id === "free" ? "Free" : t.limits.stories ? t.name : "Unlimited",
  // (only the admin sees the safety limits)
  button: current ? "Current plan" : "",
  current,
  intro: t.id === "admin" ? "The test account gets:" : "Every family gets:",
  features: tierRows(t).map((r) => `${r.label}: ${r.value}`),
  caps: tierCaps(t),
});

const COMING: Card = {
  key: "coming",
  icon: <SeedlingMark />,
  name: "More plans",
  tagline: "Growing soon",
  price: "Coming soon",
  button: "",
  current: false,
  intro: "Everything in Basic, and more of:",
  features: ["More new stories each week", "More custom character slots", "Longer stories and new features first"],
};

/** Account tier on Manage account: a short summary of your plan - its
 *  icon, name and key points - and Manage, which opens the plans page. */
export function AccountTier({ isAdmin, tier: tierId, credits }: { isAdmin: boolean; tier?: TierId; credits?: number | null }) {
  const tier = tierFor({ isAdmin, tier: tierId });
  return (
    <section className="panel account-tier">
      <div className="tier-summary-head">
        <h3>Account tier</h3>
        <Link className="btn btn-soft tier-manage" href="/account/plans">
          Manage
        </Link>
      </div>
      <div className="tier-summary">
        <span className="tier-badge" aria-hidden>
          {isAdmin ? <CrownMark /> : <MapleMark />}
        </span>
        <div>
          <p className="tier-summary-name">{tier.name}</p>
          <ul className="tier-summary-points">
            {tierRows(tier).slice(0, 3).map((r) => (
              <li key={r.label}>
                {r.label}: <b>{r.value}</b>
              </li>
            ))}
            {/* (only once an account holds some: there's nowhere to buy
                them yet, so "0 credits" would only puzzle) */}
            {!isAdmin && typeof credits === "number" && credits > 0 && (
              <li>
                On-demand credits: <b>{credits.toLocaleString("en-GB")}</b>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The plans page: every plan as a card in one sideways row, your own
 *  first and in the middle of the page; the others are a swipe away. Dots
 *  below show how many there are, the one in the middle drawn as a long
 *  bar. A family on Free sees Free, then what's coming; the admin sees
 *  their own plan, then the others, to look at but not switch to. Each
 *  card's safety limits sit in a fold at its foot. */
export function AccountPlans({ isAdmin, tier: tierId }: { isAdmin: boolean; tier?: TierId }) {
  const mine = tierFor({ isAdmin, tier: tierId });
  // The other plans can be switched to from here: for the admin every other
  // plan is a step down (shown, never switchable); for a family on Free the
  // paid plans are upgrades - offered once they actually exist.
  const others = (c: Card, label: string): Card => ({ ...c, button: label });
  const noCaps = (c: Card): Card => ({ ...c, caps: undefined });
  const cards: Card[] = isAdmin
    ? [fromTier(PLANS.admin, true), others(fromTier(PLANS.free, false), "Downgrade to Basic"), others(COMING, "Downgrade")]
    : [noCaps(fromTier(mine, true)), others(COMING, "Upgrade - coming soon")];
  return (
    <div className="account-plans">
      {/* a line across, with what follows named on it */}
      <h3 className="tier-other-plans plans-divider">
        <span>Manage plan</span>
      </h3>
      {/* (the admin's own plan is set apart from the plans families have) */}
      <PlanRow cards={cards} divideAfter={isAdmin ? 0 : undefined} />
    </div>
  );
}

function PlanRow({ cards, divideAfter }: { cards: Card[]; divideAfter?: number }) {
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let raf = 0;
    // The card in view is the one nearest the middle of the row.
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const mid = box.left + box.width / 2;
        let best = 0;
        let near = Infinity;
        el.querySelectorAll(":scope > .plan-card").forEach((c, i) => {
          const r = c.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - mid);
          if (d < near) {
            near = d;
            best = i;
          }
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [cards.length]);
  const go = (i: number) => {
    const el = row.current;
    const card = el?.querySelectorAll<HTMLElement>(":scope > .plan-card")[i];
    if (!el || !card) return;
    const box = el.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    el.scrollTo({ left: el.scrollLeft + (r.left + r.width / 2) - (box.left + box.width / 2), behavior: "smooth" });
  };
  return (
    <>
      <div className="plan-row" ref={row} data-count={cards.length}>
        {cards.map((c, i) => (
          <Fragment key={c.key}>
            <PlanCard card={c} />
            {i === divideAfter && <span className="plan-divider" aria-hidden />}
          </Fragment>
        ))}
      </div>
      {cards.length > 1 && (
        <div className="plan-dots" role="tablist" aria-label="Plans" data-count={cards.length}>
          {cards.map((c, i) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={c.name}
              className={`plan-dot ${i === active ? "on" : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PlanCard({ card }: { card: Card }) {
  return (
    <article className={`plan-card plan-${card.key} ${card.current ? "current" : ""}`}>
      {/* icon and name on one line; the pill says whether it's yours, and its price */}
      <div className="plan-top">
        <span className="tier-badge plan-badge" aria-hidden>
          {card.icon}
        </span>
        <h4 className="plan-name">{card.name}</h4>
        <span className={`plan-pill ${card.current ? "current" : ""}`}>{card.current ? `Current · ${card.price}` : card.price}</span>
      </div>
      <p className="plan-tagline">{card.tagline}</p>
      {/* (no plan can be switched to yet: the current plan says so, the rest
          are shown as they will work, disabled) */}
      {!card.current && (
        <button type="button" className="btn btn-block btn-primary plan-btn" disabled aria-disabled="true">
          {card.button}
        </button>
      )}
      <div className="plan-features">
        <p>{card.intro}</p>
        <ul>
          {card.features.map((f) => (
            <li key={f}>
              <span className="plan-tick" aria-hidden>
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>
        {card.caps && (
          <details className="plan-caps">
            <summary>Safety limits</summary>
            <p className="meta">Far above normal use - they only stop automated misuse.</p>
            <ul>
              {card.caps.map((c) => (
                <li key={c.label}>
                  <span>{c.label}</span>
                  <b>{c.value}</b>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
