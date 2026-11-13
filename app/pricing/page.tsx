import type { Metadata } from "next";
import Link from "next/link";
import { PLANS, PUBLIC_PLANS, CHARACTER_CREDITS, CREDIT_PRICE_CENTS, CREDIT_DISCOUNTS, FREE_STORY_MINUTES } from "@/lib/tiers";
import { STORY_LENGTHS } from "@/lib/ages";

export const metadata: Metadata = {
  title: { absolute: "Pricing at Taleo" },
  description: "What Taleo's plans and credits cost, and why: prices set close to what each story costs to make.",
  alternates: { canonical: "/pricing" },
};

const money = (usd: number) => `US$${usd.toFixed(2)}`;
const per = (a: { week?: boolean; month?: boolean }) => (a.week ? "a week" : a.month ? "a month" : "");

/**
 * Pricing, in plain words: the plans and credits (read from lib/tiers, so
 * this page never disagrees with the checkout) and why they cost what they
 * do. Keep the "why" true: change it if the way prices are set changes.
 */
export default function PricingPage() {
  const discounts = [...CREDIT_DISCOUNTS].sort((a, b) => a.from - b.from).map((d) => `${d.off}% off from ${d.from} credits`);
  return (
    <div className="container about policy">
      <header className="wizard-head">
        <p className="eyebrow">Plain and simple</p>
        <h1>Pricing at Taleo</h1>
      </header>

      <article className="policy-body">
        <h2>Why it costs what it does</h2>
        <p>
          Taleo is a small, independent project, made by a parent for families. It has no outside funding and isn&apos;t run to make a profit. Every story is written, painted and read aloud fresh for you, and each of those steps costs us something to make.
        </p>
        <p>
          So for now, our prices are set by what the stories cost to make: about break-even, and on some stories a little below. As we go, we&apos;ll keep working to bring those costs down, and our prices with them. Any support, whether a plan, a few credits or simply telling a friend, is truly appreciated.
        </p>

        <h2>The plans</h2>
        <div className="pricing-plans">
          {PUBLIC_PLANS.map((id) => {
            const p = PLANS[id];
            const l = p.limits;
            return (
              <section key={id} className="pricing-plan">
                <h3>{p.name}</h3>
                <p className="pricing-price">{p.monthlyUsd ? `${money(p.monthlyUsd)} a month` : "Free"}</p>
                <p className="meta">{p.blurb}</p>
                <ul>
                  {l.stories && (
                    <li>
                      {l.stories.count} free {l.stories.count === 1 ? "story" : "stories"} {per(l.stories)}
                    </li>
                  )}
                  {l.weeklyCredits > 0 && <li>{l.weeklyCredits} extra credits every week</li>}
                  {l.designs && (
                    <li>
                      {l.designs.count} new {l.designs.count === 1 ? "character" : "characters"} {per(l.designs)}
                    </li>
                  )}
                  <li>Up to {l.characters} saved characters</li>
                </ul>
              </section>
            );
          })}
        </div>
        <p className="meta">
          Paid plans renew each month. You can cancel at any time and keep your plan until the end of the month you&apos;ve paid for. A plan&apos;s free story is a {STORY_LENGTHS[0].name} ({FREE_STORY_MINUTES} minutes); a longer story uses it and makes up the difference with credits.
        </p>

        <h2>Credits</h2>
        <p>
          Credits pay for anything beyond your plan. A story costs a credit a minute ({STORY_LENGTHS.map((s) => `${s.name} ${s.minutes}`).join(", ")}), and a new character costs {CHARACTER_CREDITS}. Reading a story that&apos;s already made is always free.
        </p>
        <p>
          A credit costs {money(CREDIT_PRICE_CENTS / 100)}
          {discounts.length ? `, with ${discounts.join(" and ")}` : ""}. Credits you buy never expire.
        </p>

        <div className="pricing-cta">
          <Link href="/account/plans" className="btn btn-primary">
            Manage plan and credits
          </Link>
        </div>
      </article>
    </div>
  );
}
