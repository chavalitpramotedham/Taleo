import type { Metadata } from "next";
import Link from "next/link";
import { JOURNEY } from "@/content/journey";

export const metadata: Metadata = {
  title: { absolute: "The Taleo Journey" },
  description: "How Taleo grew, day by day: what changed, and what it means for bedtime.",
  alternates: { canonical: "/journey" },
};

const FIRST = JOURNEY[0]?.date ?? "2026-11-07";
const dayNumber = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${FIRST}T00:00:00Z`)) / 86_400_000) + 1;
const longDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * The Taleo Journey: a vertical timeline of how the platform grew, newest
 * day first, from the entries in content/journey (added to at the end of
 * each day of development).
 */
export default function JourneyPage() {
  const days = [...JOURNEY].reverse();
  const total = JOURNEY.reduce((t, d) => t + d.updates, 0);
  return (
    <div className="container about policy journey">
      <header className="wizard-head">
        <p className="eyebrow">Built in the open</p>
        <h1>The Taleo Journey</h1>
        <p className="journey-sum">
          <b>{JOURNEY.length}</b> days · <b>{total.toLocaleString("en-GB")}</b> updates shipped
        </p>
      </header>

      <p className="journey-intro">
        Taleo is made by a parent, a little every day. Here is how it has grown so far: what changed each day, and what it means at bedtime. Something you&apos;d love to see next? <Link href="/about#contact">Tell us</Link>.
      </p>

      <ol className="journey-line">
        {days.map((d, i) => (
          <li key={d.date} className={`journey-day${i === 0 ? " latest" : ""}`}>
            <span className="journey-dot" aria-hidden="true" />
            <div className="journey-card">
              <p className="journey-when">
                <span className="journey-daynum">Day {dayNumber(d.date)}</span> · {longDate(d.date)}
                {i === 0 && <span className="journey-today">Latest</span>}
              </p>
              <h2>{d.title}</h2>
              <p className="journey-count">
                {d.updates} {d.updates === 1 ? "update" : "updates"} shipped
              </p>
              <ul>
                {d.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              {d.shot && (
                <figure className="journey-shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.shot.src} alt={d.shot.alt} loading="lazy" decoding="async" width={390} height={844} />
                  <figcaption>The home page that evening</figcaption>
                </figure>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
