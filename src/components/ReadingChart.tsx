"use client";
import { useEffect, useRef, useState } from "react";
import { currentStreak, localDay } from "@/lib/reading-client";

const CELL = 13; // px, plus the gap below
const GAP = 3;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The days you read together, like a garden of little squares: one column
 *  per week (Sunday at the top), today at the far right, a filled square
 *  for every day you read - with the current streak above. As many weeks
 *  as fit the screen. */
export function ReadingChart() {
  const [days, setDays] = useState<Set<string> | null>(null);
  const [weeks, setWeeks] = useState(18);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/user/reading", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d: { days?: string[] }) => live && setDays(new Set(d.days ?? [])))
      .catch(() => live && setDays(new Set()));
    return () => {
      live = false;
    };
  }, []);

  // as many whole weeks as fit across
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setWeeks(Math.max(8, Math.min(53, Math.floor((el.clientWidth - 30 + GAP) / (CELL + GAP)))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  // the grid starts on the Sunday `weeks - 1` weeks before this week's
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
  const cols: { day: string; date: Date; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      col.push({ day: localDay(date), date, future: date > today });
    }
    cols.push(col);
  }
  const set = days ?? new Set<string>();
  const streak = days ? currentStreak(set, today) : 0;
  const shown = cols.flat().filter((c) => !c.future && set.has(c.day)).length;
  const readToday = set.has(localDay(today));

  return (
    <section className="reading-chart" aria-label="Your reading days">
      <div className="reading-chart-head">
        <p className="reading-streak">
          <span className="reading-streak-num">{days ? streak : "–"}</span>
          <span>{streak === 1 ? "day streak" : "day streak"}</span>
        </p>
        <p className="meta reading-chart-sub">
          {!days ? " " : readToday ? "You've read together today." : streak ? "Read tonight to keep it going." : "Read a story together to start a streak."}
        </p>
      </div>
      <div className="reading-grid-wrap" ref={box}>
        <div className="reading-days" aria-hidden>
          {DAY_LABELS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="reading-grid-scroll">
          <div className="reading-months" aria-hidden>
            {cols.map((col, i) => {
              const first = col.find((c) => c.date.getDate() <= 7 && c.date.getDay() === 0) ?? (i === 0 ? col[0] : null);
              return <span key={i}>{first && first.date.getDate() <= 7 ? MONTHS[first.date.getMonth()] : ""}</span>;
            })}
          </div>
          <div className="reading-grid" role="img" aria-label={`${shown} reading ${shown === 1 ? "day" : "days"} in the last ${weeks} weeks; current streak ${streak} ${streak === 1 ? "day" : "days"}`}>
            {cols.map((col, i) => (
              <div key={i} className="reading-col">
                {col.map((c) => (
                  <span
                    key={c.day}
                    className={`reading-cell ${c.future ? "future" : set.has(c.day) ? "read" : ""} ${c.day === localDay(today) ? "today" : ""}`}
                    title={c.future ? undefined : `${c.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}${set.has(c.day) ? " - read together" : ""}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="meta reading-chart-foot">
        {days ? `${shown} ${shown === 1 ? "day" : "days"} of reading in the last ${Math.round(weeks / 4.35)} months` : " "}
      </p>
    </section>
  );
}
