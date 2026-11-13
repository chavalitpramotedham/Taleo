"use client";
import { useState } from "react";

/** One day's bars, and what its tooltip says. */
export interface ChartDay {
  day: string;
  /** heights, 0-100 */
  cost: number;
  stories?: number;
  lines: string[];
}

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The dashboard's daily bars. Hovering a day (or tapping it, on a touch
 * screen) shows a small card with its numbers above the chart, and lights
 * that day's bars - the browser's own tooltip was slow to appear and never
 * did on a phone.
 */
export function DailyChart({ days, label }: { days: ChartDay[]; label: string }) {
  const [at, setAt] = useState<number | null>(null);
  const d = at === null ? null : days[at];
  return (
    <div className="admin-chart-wrap" onMouseLeave={() => setAt(null)}>
      {d && (
        <div className="admin-chart-tip" style={{ left: `${Math.min(88, Math.max(12, ((at! + 0.5) / days.length) * 100))}%` }} role="status">
          <b>{dayLabel(d.day)}</b>
          {d.lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
      <div className="admin-chart" role="img" aria-label={label}>
        {days.map((x, i) => (
          <button
            key={x.day}
            type="button"
            className={`admin-bar-col${i === at ? " on" : ""}`}
            aria-label={`${dayLabel(x.day)}: ${x.lines.join(", ")}`}
            onMouseEnter={() => setAt(i)}
            onFocus={() => setAt(i)}
            onClick={() => setAt((cur) => (cur === i ? null : i))}
          >
            <span className="admin-bar admin-bar-cost" style={{ height: `${x.cost}%` }} />
            {x.stories !== undefined && <span className="admin-bar admin-bar-stories" style={{ height: `${x.stories}%` }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
