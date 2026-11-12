"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Rights } from "@/server/rights";
import { PaymentSafety, ShieldIcon } from "@/components/PaymentSafety";
import { CrownMark, MapleMark, OrnamentRule } from "@/components/Icons";
import { isPaidPlan, PLANS, PUBLIC_PLANS, tierCaps, tierFor, tierRows, type TierId, type TierInfo, type TierRow } from "@/lib/tiers";

type Card = {
  key: string;
  icon: React.ReactNode;
  name: string;
  tagline: string;
  price: string;
  button: string;
  /** what the button does (none: it's shown, disabled) */
  act?: () => void;
  /** a line under the tagline: when it renews or ends, what follows it */
  status?: string;
  current: boolean;
  intro: string;
  features: TierRow[];
  caps?: TierRow[];
};

const fromTier = (t: TierInfo, current: boolean): Card => ({
  key: t.id,
  icon: t.id === "admin" ? <CrownMark /> : <MapleMark />,
  name: t.name,
  tagline: t.blurb,
  // (the plan everyone has costs nothing, whatever it's called)
  // (US$, as the credit packs say it: the same currency everywhere)
  price: t.id === "free" ? "Free" : t.monthlyUsd ? `US$${t.monthlyUsd.toFixed(2)}/mo` : t.limits.stories ? t.name : "Unlimited",
  button: "",
  current,
  intro: t.id === "admin" ? "The test account gets:" : t.id === "free" ? "Every family gets:" : "Each week and month:",
  features: tierRows(t),
  // (only the admin sees the safety limits)
  caps: tierCaps(t),
});

const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

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
                Bought credits: <b>{credits.toLocaleString("en-GB")}</b>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The plans page: every plan as a card in one sideways row, your own
 *  first; the others are a swipe away. Dots below show how many there
 *  are. A family sees Basic, Plus and Pro, each with a button to move to
 *  it (Stripe's own pages take the payment, and the plan changes once
 *  Stripe confirms it); the admin sees their own plan, then the others,
 *  to look at but not switch to. */
export function AccountPlans({ isAdmin, tier: tierId, subscription = null, open = false }: { isAdmin: boolean; tier?: TierId; subscription?: Rights["subscription"]; open?: boolean }) {
  const mine = tierFor({ isAdmin, tier: tierId });
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  // Back from Stripe's checkout (?subscribed=plus): the plan changes when
  // Stripe's own notice arrives - usually within seconds. Until then this
  // says so, and looks again every few seconds.
  const [waitingFor, setWaitingFor] = useState<TierId | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("subscribed");
    if (!isPaidPlan(p)) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (p !== tierId) setWaitingFor(p);
    else setNote({ text: `Welcome to ${PLANS[p].name}!` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!waitingFor) return;
    if (tierId === waitingFor) {
      setWaitingFor(null);
      setNote({ text: `Welcome to ${PLANS[waitingFor].name}! Your plan has changed.` });
      return;
    }
    let tries = 0;
    const t = window.setInterval(() => {
      tries++;
      router.refresh();
      if (tries >= 40) {
        window.clearInterval(t);
        setWaitingFor(null);
        setNote({ text: "Stripe hasn't confirmed the payment yet. Your plan will change as soon as it does - you can leave this page." });
      }
    }, 3000);
    return () => window.clearInterval(t);
  }, [waitingFor, tierId, router]);

  const send = async (body: { plan?: TierId; portal?: boolean }) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/account/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = (await res.json().catch(() => ({}))) as { url?: string; message?: string; error?: string; change?: string };
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      if (!res.ok) throw new Error(d.message || d.error || "That couldn't be done just now. Please try again.");
      setNote({ text: d.message || "Done." });
      // (a move up comes through in a moment: look again until it has)
      if (d.change === "now" && isPaidPlan(body.plan)) setWaitingFor(body.plan);
      else router.refresh();
    } catch (e) {
      setNote({ text: e instanceof TypeError ? "No connection - check your internet and try again." : e instanceof Error ? e.message : "That couldn't be done just now.", error: true });
    }
    setBusy(false);
  };
  const portal = () => void send({ portal: true });

  const others = (c: Card, label: string): Card => ({ ...c, button: label });
  const noCaps = (c: Card): Card => ({ ...c, caps: undefined });
  // (each plan with what moving to it means, for this family)
  const forFamily = (id: TierId): Card => {
    const c = noCaps(fromTier(PLANS[id], id === mine.id));
    const sub = subscription?.live ? subscription : null;
    if (id === mine.id) {
      if (sub?.ending) return { ...c, status: `Until ${day(sub.periodEnd)}, then Basic`, button: `Keep ${c.name}`, act: open ? () => void send({ plan: id }) : undefined };
      if (sub?.status === "past_due") return { ...c, status: "The last payment didn't go through", button: "Update card", act: open ? portal : undefined };
      if (sub?.nextPlan) return { ...c, status: `Moves to ${PLANS[sub.nextPlan].name} on ${day(sub.periodEnd)}` };
      if (sub) return { ...c, status: `Renews ${day(sub.periodEnd)}` };
      return c;
    }
    if (!open) return { ...c, button: "Coming soon" };
    if (id === "free") return sub?.ending ? c : { ...c, button: "Cancel in billing", act: subscription?.manageable ? portal : undefined };
    if (sub?.nextPlan === id) return { ...c, status: `From ${day(sub.periodEnd)}`, button: `Stay on ${mine.name}`, act: () => void send({ plan: mine.id }) };
    const up = mine.id === "free" || (mine.id === "plus" && id === "pro");
    return { ...c, button: up ? `Upgrade to ${c.name}` : `Move to ${c.name}`, act: () => void send({ plan: id }) };
  };
  const cards: Card[] = isAdmin
    ? [fromTier(PLANS.admin, true), ...PUBLIC_PLANS.map((id) => others(fromTier(PLANS[id], false), id === "free" ? "Downgrade to Basic" : `${PLANS[id].name} (for families)`))]
    : // (your own first, then the rest in order)
      [forFamily(mine.id), ...PUBLIC_PLANS.filter((id) => id !== mine.id).map(forFamily)];
  return (
    <div className="account-plans">
      {/* a line across, with what follows named on it */}
      <OrnamentRule className="home-divider plans-rule" />
      <header className="home-shelf-head plans-head">
        <h2>Manage plan</h2>
      </header>
      {(waitingFor || note) && (
        <p className={`plan-note${note?.error ? " error" : ""}`} role="status">
          {waitingFor ? `Confirming your payment with Stripe - ${PLANS[waitingFor].name} starts as soon as it's through...` : note?.text}
        </p>
      )}
      {/* (the admin's own plan is set apart from the plans families have) */}
      <PlanRow cards={busy ? cards.map((c) => ({ ...c, act: undefined })) : cards} divideAfter={isAdmin ? 0 : undefined} />
      {!isAdmin && open && subscription?.manageable && (
        <p className="plan-manage">
          <button type="button" className="link-btn" onClick={portal} disabled={busy}>
            Manage subscription
          </button>
          <span className="meta"> - card, invoices and cancelling, on Stripe</span>
        </p>
      )}
      {!isAdmin && open && (
        <details className="plan-safety">
          <summary>
            <ShieldIcon /> Paying safely
          </summary>
          <PaymentSafety open plans />
        </details>
      )}
      {!isAdmin && open && (
        <p className="meta plan-fine">
          Plans renew monthly from the day you join, until cancelled. Cancelling keeps your plan until the month paid for ends; there are no refunds for the days left. Weekly credits don&apos;t carry over. Bought credits are yours on every plan.
        </p>
      )}
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
      {card.status && <p className="plan-status">{card.status}</p>}
      {/* (a plan that can't be moved to from here is shown as it would work, disabled) */}
      {card.button && (
        <button type="button" className={`btn btn-block ${card.current ? "btn-soft" : "btn-primary"} plan-btn`} disabled={!card.act} aria-disabled={!card.act} onClick={card.act}>
          {card.button}
        </button>
      )}
      <div className="plan-features">
        <p>{card.intro}</p>
        <ul>
          {card.features.map((f) => (
            <li key={f.label}>
              <span className="plan-tick" aria-hidden>
                ✓
              </span>
              <span className="plan-feature">
                <span>
                  {f.label}: <b>{f.value}</b>
                </span>
                {f.note && <small>{f.note}</small>}
              </span>
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
