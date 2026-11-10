"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { currentStreak, localDay } from "@/lib/reading-client";
import { ReadingDiary } from "./ReadingDiary";

const CELL = 13; // px, plus the gap below
const GAP = 3;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The days you read together, like a garden of little squares: one column
 *  per week (Sunday at the top), today at the far right, a filled square
 *  for every day you read - with the current streak above. As many weeks
 *  as fit the screen.
 *
 *  It's a diary too: a filled square opens that day - the stories made on
 *  it and the stories read. (A story of your own counts on the day it was
 *  made, whether or not the day was logged at the time.) */
export function ReadingChart() {
  const [days, setDays] = useState<Set<string> | null>(null);
  const [joined, setJoined] = useState<number | null>(null);
  const [read, setRead] = useState<Record<string, string[]>>({});
  const [made, setMade] = useState<{ id: string; at: number }[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(18);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/user/reading", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d: { days?: string[]; joined?: number | null; read?: Record<string, string[]>; made?: { id: string; at: number }[] }) => {
        if (!live) return;
        setJoined(d.joined ?? null);
        setRead(d.read ?? {});
        setMade(d.made ?? []);
        setDays(new Set(d.days ?? []));
      })
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
  const todayKey = localDay(today);
  const yearAgo = new Date(today);
  yearAgo.setDate(yearAgo.getDate() - 364);
  // the day you joined (if it's within the last year - otherwise the count
  // is simply "the past 12 months")
  const joinedKey = joined ? localDay(new Date(joined)) : null;
  const sinceJoining = Boolean(joinedKey && joinedKey > localDay(yearAgo));
  const fromKey = sinceJoining ? joinedKey! : localDay(yearAgo);

  // the grid starts on the Sunday `weeks - 1` weeks before this week's
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
  const cols: { day: string; date: Date; future: boolean; pre: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const day = localDay(date);
      col.push({ day, date, future: date > today, pre: Boolean(joinedKey && day < joinedKey) });
    }
    cols.push(col);
  }
  const joinedShown = Boolean(joinedKey && cols.some((col) => col.some((c) => c.day === joinedKey)));

  // Your own stories, on the day (here) each was made - newest first.
  const madeOn = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const m of [...made].sort((a, b) => b.at - a.at)) {
      const day = localDay(new Date(m.at));
      by.set(day, [...(by.get(day) ?? []), m.id]);
    }
    return by;
  }, [made]);
  const mine = useMemo(() => new Set(made.map((m) => m.id)), [made]);
  // A day counts if a story was finished on it - or made on it.
  const set = useMemo(() => new Set([...(days ?? []), ...madeOn.keys()]), [days, madeOn]);
  const diaryDays = useMemo(() => [...set].sort(), [set]);
  const at = openDay ? diaryDays.indexOf(openDay) : -1;
  const streak = days ? currentStreak(set, today) : 0;
  const total = [...set].filter((d) => d >= fromKey && d <= todayKey).length;
  const readToday = set.has(todayKey);
  const span = sinceJoining ? "since you joined" : "in the past 12 months";
  const daysRead = `${total.toLocaleString()} ${total === 1 ? "day" : "days"} read`;

  // With a streak, it leads (and the total follows); without one, the
  // total leads, with a nudge to begin one tonight.
  // Not a single story finished since joining: a beginning, not a zero.
  const fresh = Boolean(days) && !total && sinceJoining;
  const primary = streak ? { num: streak, label: "day streak" } : { num: total, label: total === 1 ? "day read" : "days read" };
  const secondary = !days
    ? "\u00a0"
    : fresh
      ? "Finish a story together and today's square turns green - that's day one of your streak."
      : streak
      ? `${daysRead} ${span}${readToday ? "" : " · finish a story tonight to keep it going"}`
      : `${total ? `${span[0].toUpperCase()}${span.slice(1)}. ` : ""}Finish a story together today to start a streak.`;

  return (
    <section className="reading-chart" aria-label="Your reading days">
      <div className="reading-chart-head">
        <p className={`reading-streak${streak ? " on" : ""}`}>
          {streak ? <FlameMark /> : null}
          {fresh ? (
            <span className="reading-streak-label reading-streak-fresh">Your reading garden starts here</span>
          ) : (
            <>
              <span className="reading-streak-num">{days ? primary.num.toLocaleString() : "–"}</span>
              <span className="reading-streak-label">{primary.label}</span>
            </>
          )}
        </p>
        <p className="meta reading-chart-sub">
          {secondary}
          {diaryDays.length > 0 && (
            <>
              {" "}
              <button type="button" className="link-btn reading-diary-open" onClick={() => setOpenDay(diaryDays[diaryDays.length - 1])}>
                Open diary
              </button>
            </>
          )}
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
              const pre = col.every((c) => c.pre);
              return (
                <span key={i} className={pre ? "pre" : undefined}>
                  {first && first.date.getDate() <= 7 ? MONTHS[first.date.getMonth()] : ""}
                </span>
              );
            })}
          </div>
          <div className="reading-grid" role="group" aria-label={`${daysRead} ${span}; current streak ${streak} ${streak === 1 ? "day" : "days"}`}>
            {cols.map((col, i) => (
              <div key={i} className="reading-col">
                {col.map((c) => {
                  const read = !c.future && set.has(c.day);
                  const cls = c.future ? "future" : read ? "read" : c.pre ? "pre" : "";
                  const className = `reading-cell ${cls}${c.day === todayKey ? " today" : ""}${c.day === joinedKey ? " joined" : ""}`;
                  const label = `${c.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}${read ? " - read together" : ""}${c.day === joinedKey ? " - you joined Taleo" : ""}`;
                  // (a day with a story in it opens as a diary page)
                  return read ? (
                    <button key={c.day} type="button" className={className} title={`${label} · open diary`} aria-label={`${label}. Open diary`} onClick={() => setOpenDay(c.day)} />
                  ) : (
                    <span key={c.day} className={className} title={c.future || c.pre ? undefined : label} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ul className="reading-legend" aria-label="Key">
        {joinedShown && (
          <li>
            <span className="reading-cell joined" aria-hidden />
            You joined
          </li>
        )}
        <li>
          <span className="reading-cell read" aria-hidden />
          Finished a story
        </li>
        <li>
          <span className="reading-cell today" aria-hidden />
          Today
        </li>
      </ul>
      {openDay && (
        <ReadingDiary
          day={openDay}
          made={madeOn.get(openDay) ?? []}
          read={read[openDay] ?? []}
          mine={mine}
          earlier={at > 0 ? diaryDays[at - 1] : null}
          later={at >= 0 && at < diaryDays.length - 1 ? diaryDays[at + 1] : null}
          onDay={setOpenDay}
          onClose={() => setOpenDay(null)}
        />
      )}
    </section>
  );
}

/** A small ember for a streak that's alight. */
function FlameMark() {
  return (
    <svg className="reading-flame" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d="M12.6 2.5c.4 3.1-1.3 4.9-2.9 6.6C8 10.9 6.5 12.6 6.5 15.4A5.6 5.6 0 0 0 12 21a5.6 5.6 0 0 0 5.5-5.6c0-2.3-1-4-2-5.3-.2 1.3-.8 2.3-1.8 2.8.6-3.6-.4-7.4-1.1-9.4Z" fill="currentColor" />
      <path d="M12.2 13.2c-1.6 1.4-2.4 2.5-2.4 3.7A2.2 2.2 0 0 0 12 19.1a2.2 2.2 0 0 0 2.2-2.2c0-1.4-1-2.6-2-3.7Z" fill="#f6d27a" />
    </svg>
  );
}
