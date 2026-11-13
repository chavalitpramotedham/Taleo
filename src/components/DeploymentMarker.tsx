"use client";
import { useEffect, useState } from "react";
import type { DeployedCommit, Deployment, LiveStatus } from "@/lib/deployment";
import { useEscape } from "@/lib/useEscape";
import { InfoIcon } from "./Icons";

/** The version this page was built from (a short commit id). */
const PAGE_SHA = process.env.TALEO_BUILD_SHA || "";
const CHECK_MS = 20_000;
/** What was last heard (shown at once when the menu opens again). */
let known: Deployment | null = null;

/** Asks the site what's live, and so whether it can be reached at all. */
async function check(): Promise<{ live: Deployment | null; status: LiveStatus }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { live: known, status: "offline" };
  try {
    const r = await fetch("/api/admin/deployment", { cache: "no-store" });
    if (!r.ok) return { live: known, status: "offline" };
    const d = (await r.json()) as Deployment;
    known = d;
    // (a different commit from the one this page was built from: a newer
    // version has gone live while the page stayed open)
    return { live: d, status: PAGE_SHA && d.sha && !d.sha.startsWith(PAGE_SHA) ? "update" : "live" };
  } catch {
    return { live: known, status: "offline" };
  }
}
const STATUS_WORDS: Record<LiveStatus, string> = { live: "Live", update: "A newer version is live - reload to get it", offline: "Can't reach the site just now" };

const short = (sha: string) => sha.slice(0, 7);
const when = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso);
  return iso && !isNaN(d.getTime()) ? d.toLocaleString(undefined, opts) : "";
};
const BRIEF: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
const FULL: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };

/** "3 hours ago", for a glance at how fresh the live site is. */
function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!iso || isNaN(ms)) return "";
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * What's live, at the foot of the admin's account menu (under Sign out):
 * the version and commit the site is running, and when it was deployed.
 * A tap on it opens everything about that deployment, with the log of
 * what changed (the dialog below, which the menu shows once it has closed). Only ever drawn for the admin account, and its facts come
 * from an admin-only address - nothing of it is in anyone else's page.
 */
export function DeploymentMarker({ onShow }: { onShow: (live: Deployment) => void }) {
  const [live, setLive] = useState<Deployment | null>(known);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  // Asked as the menu opens, every twenty seconds while it stays open, and
  // the moment the device goes on or off line - so the light means what
  // it shows: green and pulsing while the site answers and this page is
  // the version that's live.
  useEffect(() => {
    let here = true;
    const ask = () =>
      void check().then((c) => {
        if (!here) return;
        setLive(c.live);
        setStatus(c.status);
      });
    ask();
    const every = window.setInterval(ask, CHECK_MS);
    window.addEventListener("online", ask);
    window.addEventListener("offline", ask);
    return () => {
      here = false;
      window.clearInterval(every);
      window.removeEventListener("online", ask);
      window.removeEventListener("offline", ask);
    };
  }, []);
  if (!live) {
    return (
      <p className="deploy-marker deploy-marker-quiet">
        {status === "offline" && <span className="deploy-dot offline" aria-hidden />}
        {status === "offline" ? "Can't reach the site just now" : "Reading what's live…"}
      </p>
    );
  }
  const state = status ?? "live";
  return (
    <>
      <button
        type="button"
        className="deploy-marker"
        role="menuitem"
        aria-label={`${STATUS_WORDS[state]}. Version ${live.version}, ${short(live.sha)}, ${when(live.builtAt, BRIEF)}. Show the details`}
        onClick={() => onShow({ ...live, status: state })}
      >
        <span className="deploy-marker-text">
          <span className="deploy-marker-version">
            <span className={`deploy-dot ${state}${status ? "" : " checking"}`} aria-hidden />v{live.version}
            {live.sha && <code>{short(live.sha)}</code>}
          </span>
          <span className="deploy-marker-when">
            {state === "update" ? "Newer version live · reload" : state === "offline" ? "Offline" : when(live.builtAt, BRIEF) || "Live"}
          </span>
          {/* (what readers' pages are painted with) */}
          <span className="deploy-marker-when deploy-marker-paint">
            Painting: {live.painting ? (
              <>
                <code>{live.painting.code}</code> {live.painting.name}
              </>
            ) : (
              "classic"
            )}
          </span>
        </span>
        <InfoIcon />
      </button>
    </>
  );
}

/** Everything about the deployment that's live, and the log of what
 *  changed: each commit's message as it was written. */
export function DeploymentDialog({ live, onClose }: { live: Deployment; onClose: () => void }) {
  useEscape(onClose);
  const state = live.status ?? "live";
  const facts: [string, React.ReactNode][] = [
    ["Status", STATUS_WORDS[state]],
    ["Version", `v${live.version}`],
    ["Painting", live.painting ? `${live.painting.code} (${live.painting.name})` : "classic (TALEO_PAINT_LIVE=0)"],
    ["Commit", live.sha ? <code key="c">{live.sha}</code> : "-"],
    ["Branch", live.branch || "-"],
    ["Deployed", [when(live.builtAt, FULL), ago(live.builtAt)].filter(Boolean).join(" · ") || "-"],
    ["Environment", live.environment],
    ...(live.url ? ([["Address", <a key="u" href={live.url} target="_blank" rel="noreferrer">{live.url.replace(/^https:\/\//, "")}</a>]] as [string, React.ReactNode][]) : []),
    ...(live.deploymentId ? ([["Deployment", <code key="d">{live.deploymentId}</code>]] as [string, React.ReactNode][]) : []),
    ...(live.region ? ([["Server region", live.region]] as [string, React.ReactNode][]) : []),
    ...(live.dataKey
      ? ([["Data key", live.dataKey === "own" ? "Its own - all records moved" : live.dataKey === "moving" ? "Its own - moving records (look again in a minute)" : "Shared with the sign-in secret"]] as [string, React.ReactNode][])
      : []),
  ];
  const fresh = live.fresh ?? 0;
  const first = live.commits.slice(0, fresh || 1);
  const rest = live.commits.slice(fresh || 1);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel deploy-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="What's live">
        <div className="modal-head">
          <h3>
            <span className={`deploy-dot ${state}`} aria-hidden />
            What&apos;s live
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="deploy-scroll">
          <dl className="deploy-facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {live.commits.length === 0 ? (
            <p className="meta">The log of changes wasn&apos;t available when this was built.</p>
          ) : (
            <>
              <h4>{fresh > 1 ? `In this deployment (${fresh} changes)` : fresh === 1 ? "In this deployment" : "The latest change"}</h4>
              <ol className="deploy-log">
                {first.map((c) => (
                  <Change key={c.sha} c={c} open />
                ))}
              </ol>
              {rest.length > 0 && (
                <>
                  <h4>Before that</h4>
                  <ol className="deploy-log">
                    {rest.map((c) => (
                      <Change key={c.sha} c={c} />
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** One commit: its title, when, and what was logged about it (the
 *  message's own paragraphs and lists, minus the sign-off lines). */
function Change({ c, open = false }: { c: DeployedCommit; open?: boolean }) {
  const session = c.body.match(/^Claude-Session:\s*(https:\/\/\S+)/m)?.[1];
  // A commit message is wrapped at 72 letters for a terminal. Here its
  // paragraphs run to the dialog's own width: lines of a paragraph are
  // joined again, while each list item ("- ...") keeps a line of its own.
  const body = c.body
    .split("\n")
    .filter((l) => !/^(Co-Authored-By|Claude-Session|Signed-off-by):/i.test(l))
    .join("\n")
    .trim()
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split("\n")
        .reduce<string[]>((lines, l) => {
          if (!lines.length || /^\s*([-*•]|\d+[.)])\s/.test(l)) lines.push(l.trimEnd());
          else lines[lines.length - 1] += ` ${l.trim()}`;
          return lines;
        }, [])
        .join("\n"),
    )
    .join("\n\n");
  return (
    <li>
      <details open={open}>
        <summary>
          <span className="deploy-log-title">{c.subject}</span>
          <span className="deploy-log-meta">
            <code>{short(c.sha)}</code>
            {when(c.at, BRIEF) && <> · {when(c.at, BRIEF)}</>}
          </span>
        </summary>
        {body ? <p className="deploy-log-body">{body}</p> : <p className="meta">Nothing more was logged.</p>}
        {session && (
          <p className="deploy-log-meta">
            <a href={session} target="_blank" rel="noreferrer">
              The Claude session it was made in
            </a>
          </p>
        )}
      </details>
    </li>
  );
}
