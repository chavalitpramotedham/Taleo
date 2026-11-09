"use client";
import { useEffect, useRef, useState } from "react";
import { CrownMark, MapleMark } from "@/components/Icons";
import { TIERS, type TierInfo } from "@/lib/tiers";

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
  priceNote: string;
  button: string;
  current: boolean;
  intro: string;
  features: string[];
  caps?: TierInfo["caps"];
};

const fromTier = (t: TierInfo, current: boolean): Card => ({
  key: t.id,
  icon: t.id === "admin" ? <CrownMark /> : <MapleMark />,
  name: t.name,
  tagline: t.blurb,
  price: t.id === "admin" ? "Unlimited" : "Free",
  priceNote: t.id === "admin" ? "the keys to the castle" : "for every family",
  button: current ? "Your current plan" : "Included for everyone",
  current,
  intro: t.id === "admin" ? "Everything, without limits:" : "Every family gets:",
  features: t.rows.map((r) => `${r.label}: ${r.value}`),
  caps: t.caps,
});

const COMING: Card = {
  key: "coming",
  icon: <SeedlingMark />,
  name: "More plans",
  tagline: "Growing soon, for families who read every night.",
  price: "Soon",
  priceNote: "we'll let you know",
  button: "Coming soon",
  current: false,
  intro: "Everything in Free, and more of:",
  features: ["New stories each night", "Custom characters to keep", "Longer stories and new features first"],
};

/** Account tier: the plans as cards in a sideways row - dots below show how
 *  many there are, the one in view drawn as a long bar. A family on Free
 *  sees Free, then what's coming; the admin sees their own plan first,
 *  then (below a line) the others, to look at but not switch to. */
export function AccountTier({ isAdmin }: { isAdmin: boolean }) {
  const cards: Card[] = isAdmin ? [fromTier(TIERS.free, false), COMING] : [fromTier(TIERS.free, true), COMING];
  return (
    <section className="panel account-tier">
      <h3>Account tier</h3>
      {isAdmin && (
        <>
          <PlanCard card={fromTier(TIERS.admin, true)} />
          <p className="tier-other-plans">
            <span>Other plans</span>
          </p>
        </>
      )}
      <PlanRow cards={cards} />
    </section>
  );
}

function PlanRow({ cards }: { cards: Card[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.firstElementChild?.getBoundingClientRect().width || el.clientWidth;
        setActive(Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / (w + 14)))));
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
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };
  return (
    <>
      <div className="plan-row" ref={row}>
        {cards.map((c) => (
          <PlanCard key={c.key} card={c} />
        ))}
      </div>
      {cards.length > 1 && (
        <div className="plan-dots" role="tablist" aria-label="Plans">
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
      <div className="plan-top">
        <span className="tier-badge" aria-hidden>
          {card.icon}
        </span>
        {card.current && <span className="plan-current-pill">Your plan</span>}
      </div>
      <h4 className="plan-name">{card.name}</h4>
      <p className="plan-tagline">{card.tagline}</p>
      <p className="plan-price">
        <b>{card.price}</b>
        <span>{card.priceNote}</span>
      </p>
      <button type="button" className="btn btn-soft btn-block plan-btn" disabled>
        {card.button}
      </button>
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
