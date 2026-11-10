import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { getUser, listUsers } from "@/server/users";
import { metricsEnabled } from "@/server/metrics";
import { GEN_KINDS, NEVER_FINISHED_MS, getGen, recentGens, type GenKind, type GenRecord } from "@/server/genlog";
import type { UserProfile } from "@/lib/types";
import { AutoRefresh, When } from "./Live";
import { FindUser } from "./FindUser";
import { fuzzyPeople } from "@/lib/fuzzy";

export const metadata: Metadata = { title: "Activity", robots: { index: false, follow: false } };

const HERE = "/admin/activity";
const KIND_NAME: Record<GenKind, string> = { story: "Stories", painting: "Paintings", character: "Characters", voice: "Voice" };
const KIND_ONE: Record<GenKind, string> = { story: "Story", painting: "Painting", character: "Character", voice: "Voice" };

/** How a record ended, as it's shown: a request still "running" long after
 *  any request could be is one the platform cut off. */
type Shown = GenRecord["status"] | "cut off";
const shown = (r: GenRecord, now: number): Shown => (r.status === "running" && now - r.at > NEVER_FINISHED_MS ? "cut off" : r.status);
const STATUS_WORD: Record<Shown, string> = {
  ok: "Done",
  running: "Under way",
  error: "Failed",
  slow: "Too slow, given up on",
  refused: "Refused",
  left: "Reader left",
  denied: "Turned away",
  "cut off": "Never finished",
};
/** Something went wrong for the reader (leaving is their own doing, and
 *  being turned away at a limit is the plan working). */
const isIssue = (s: Shown) => s === "error" || s === "slow" || s === "refused" || s === "cut off";
const tone = (s: Shown) => (s === "ok" ? "good" : isIssue(s) ? "bad" : "flat");

const dur = (ms: number | undefined | null) => {
  if (ms == null) return "-";
  if (ms < 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}s`;
};
const cost = (micro: number) => (micro ? `$${(micro / 1e6).toFixed(micro < 10_000 ? 4 : 3)}` : "-");
const n = (v: number) => Math.round(v).toLocaleString("en-GB");
const median = (list: number[]) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** From the reader's side: the time the request queued on their device,
 *  plus the time the server took to send the first of the result. */
const sawFirst = (r: GenRecord) => (r.firstMs == null ? null : (r.waitedMs ?? 0) + r.firstMs);
const sawAll = (r: GenRecord) => (r.totalMs == null ? null : (r.waitedMs ?? 0) + r.totalMs);
const models = (r: GenRecord) => {
  if (!r.calls.length) return r.mock ? "(stand-in, no model)" : "-";
  const seen = new Map<string, number>();
  for (const c of r.calls) {
    const key = `${c.model}${c.effort ? ` · ${c.effort}` : ""}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].map(([k, v]) => (v > 1 ? `${k} ×${v}` : k)).join(", ");
};
/** Which of the ways its kind of request can go this one was. Records from
 *  before these were kept say some of it in `sub` ("page 2 of its part,
 *  quick painter, second go, in layers"): that's read back out. */
const casesOf = (r: GenRecord): string[] => {
  const out = [...(r.cases ?? [])];
  if (!r.cases && r.kind === "painting") {
    out.push(/second go/.test(r.sub) ? "second go" : "first go");
    if (/quick painter|main painter/.test(r.sub)) out.push(/quick painter/.test(r.sub) ? "quick painter" : "main painter");
    if (/in layers/.test(r.sub)) out.push("in layers");
  }
  if (r.mock) out.push("stand-in");
  if (r.calls.some((c) => c.asked && c.model && c.asked !== c.model)) out.push("answered by another model");
  return out;
};
/** (the old records' `sub` without what's now shown as cases) */
const subOf = (r: GenRecord) => (r.cases || r.kind !== "painting" ? r.sub : r.sub.split(",")[0]);
function Cases({ record }: { record: GenRecord }) {
  const list = casesOf(record);
  if (!list.length) return <>-</>;
  return (
    <span className="admin-cases">
      {list.map((c) => (
        <span key={c} className={`admin-case${STANDS_OUT.test(c) ? " marked" : ""}`}>
          {c}
        </span>
      ))}
    </span>
  );
}
/** The cases worth a second look in a long list. */
const STANDS_OUT = /^(second go|stand-in|answered by another model|no ticket|unsigned page)/;
const who = (u: UserProfile | null | undefined, id: string | null) => (u ? (u.username ? `@${u.username}` : u.email) : id ? `(${id.slice(0, 10)}…)` : "signed out");
const href = (params: Record<string, string | undefined | false>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${HERE}?${s}` : HERE;
};

/** Everything the app has made lately, request by request: who asked, for
 *  what, which models answered, how long the reader waited, and how it
 *  ended. Only the admin account can open it. Always computed fresh. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const id = one("id");
  const userId = one("user");
  const q = one("q");
  const kind = GEN_KINDS.find((k) => k === one("kind"));
  const issues = one("issues") === "1";
  const now = Date.now();

  if (id) return <Detail id={id} now={now} />;

  const users = await listUsers({ cacheSeconds: 60 }).catch(() => [] as UserProfile[]);
  const byId = new Map(users.map((u) => [u.id, u]));

  // A search: by email or handle (loosely: a part of either will do, and
  // so will its letters in order, or with a slip - see lib/fuzzy).
  let matches: UserProfile[] | null = null;
  let subjectId = userId;
  if (!subjectId && q) {
    const needle = q.replace(/^@/, "").toLowerCase();
    const admin = await getUser("admin");
    const everyone = admin && !byId.has(admin.id) ? [admin, ...users] : users;
    const byIdOnly = everyone.filter((u) => u.id === q);
    matches = byIdOnly.length ? byIdOnly : fuzzyPeople(q, everyone);
    const exact = matches.filter((u) => u.email.toLowerCase() === needle || (u.username ?? "").toLowerCase() === needle);
    if (exact.length === 1) matches = exact;
    if (matches.length === 1) subjectId = matches[0].id;
  }
  const subject = subjectId ? (byId.get(subjectId) ?? (await getUser(subjectId).catch(() => null))) : null;

  const all = await recentGens({ userId: subjectId, limit: subjectId ? 500 : 300 }).catch((e) => (console.error("[activity]", e), [] as GenRecord[]));
  const list = all.filter((r) => (!kind || r.kind === kind) && (!issues || isIssue(shown(r, now))));
  const keep = { user: subjectId, kind, issues: issues && "1" };

  return (
    <div className="container admin">
      <header className="wizard-head">
        <p className="eyebrow">Only you can see this</p>
        <h1>{subjectId ? `Activity: ${who(subject, subjectId)}` : "Activity"}</h1>
        <p className="sub">
          {subjectId
            ? `Everything made for this account, newest first${subject?.username ? ` (${subject.email})` : ""}.`
            : "Every story, painting, character and voice clip the app has been asked for, newest first."}
        </p>
      </header>

      <nav className="filter-row admin-pages" aria-label="Admin pages">
        <Link href="/admin" className="chip">
          Overall
        </Link>
        <Link href="/admin/activity" className="chip on" aria-current="page">
          User details
        </Link>
      </nav>
      {subjectId && (
        <p className="meta admin-crumbs">
          <Link href={HERE}>Everyone&apos;s activity</Link>
        </p>
      )}

      {!metricsEnabled() && (
        <p className="admin-note">
          <b>The log isn&apos;t being kept.</b> It lives in Upstash Redis, which isn&apos;t connected here, so what&apos;s below is only what this server has seen since it last started.
        </p>
      )}

      <section className="admin-section">
        <h2>Find a user</h2>
        <FindUser key={q ?? ""} action={HERE} searched={q ?? ""} people={users.map((u) => ({ id: u.id, username: u.username ?? null, email: u.email }))} />
        {matches && matches.length !== 1 && (
          <>
            <h3>{matches.length ? `${matches.length} accounts match “${q}”` : `Nobody matches “${q}”`}</h3>
            {matches.length > 0 && (
              <table className="admin-table">
                <tbody>
                  {matches.slice(0, 40).map((u) => (
                    <tr key={u.id}>
                      <th>
                        <Link href={href({ user: u.id })}>{u.username ? `@${u.username}` : u.email}</Link>
                      </th>
                      <td>{u.username ? u.email : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      {(!matches || matches.length === 1) && (
        <>
          <section className="admin-section">
            <h2>{subjectId ? "By kind" : "Lately"}</h2>
            <div className="admin-tiles">
              {GEN_KINDS.map((k) => (
                <KindTile key={k} kind={k} records={all.filter((r) => r.kind === k)} now={now} link={href({ ...keep, kind: k })} />
              ))}
            </div>
            <p className="meta admin-filters">
              <span>Show:</span>
              <FilterLink on={!kind} to={href({ ...keep, kind: undefined })}>
                everything
              </FilterLink>
              {GEN_KINDS.map((k) => (
                <FilterLink key={k} on={kind === k} to={href({ ...keep, kind: k })}>
                  {KIND_NAME[k].toLowerCase()}
                </FilterLink>
              ))}
              <FilterLink on={issues} to={href({ ...keep, issues: !issues && "1" })} off>
                only what went wrong
              </FilterLink>
            </p>
            <AutoRefresh />
          </section>

          {subjectId && !kind ? (
            GEN_KINDS.map((k) => {
              const rows = list.filter((r) => r.kind === k);
              return (
                <section className="admin-section" key={k}>
                  <h2>
                    {KIND_NAME[k]} <span className="admin-count">{n(rows.length)}</span>
                  </h2>
                  <Records records={rows.slice(0, 60)} now={now} users={null} />
                  {rows.length > 60 && (
                    <p className="meta admin-more">
                      The newest 60 of {n(rows.length)}. <Link href={href({ ...keep, kind: k })}>See them all</Link>
                    </p>
                  )}
                </section>
              );
            })
          ) : (
            <section className="admin-section">
              <h2>
                {kind ? KIND_NAME[kind] : "Everything"}
                {issues ? " that went wrong" : ""} <span className="admin-count">{n(list.length)}</span>
              </h2>
              <Records records={list} now={now} users={subjectId ? null : byId} kinds={!kind} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** A filter: bold when it's the one in force. One that's a switch (`off`)
 *  stays a link while on, so it can be turned off again. */
function FilterLink({ on, to, off = false, children }: { on: boolean; to: string; off?: boolean; children: ReactNode }) {
  if (on && !off) return <b className="admin-filter-on">{children}</b>;
  return (
    <Link href={to} className={on ? "admin-filter-on" : undefined}>
      {children}
      {on ? " ✕" : ""}
    </Link>
  );
}

function KindTile({ kind, records, now, link }: { kind: GenKind; records: GenRecord[]; now: number; link: string }) {
  const bad = records.filter((r) => isIssue(shown(r, now))).length;
  const done = records.filter((r) => r.status === "ok");
  const first = median(done.map(sawFirst).filter((v): v is number => v != null));
  const whole = median(done.map(sawAll).filter((v): v is number => v != null));
  const spent = records.reduce((t, r) => t + r.usdMicro, 0);
  return (
    <div className="admin-tile">
      <div className="admin-tile-head">
        <p className="admin-tile-label">
          <Link href={link}>{KIND_NAME[kind]}</Link>
        </p>
        {records.length > 0 && <span className={`admin-change ${bad ? "bad" : "good"}`}>{bad ? `${bad} went wrong` : "all well"}</span>}
      </div>
      <p className="admin-tile-value">{n(records.length)}</p>
      <p className="admin-tile-note">
        {records.length ? (
          <>
            First seen after {dur(first)}, whole after {dur(whole)} (typical)
            {spent > 0 && <> · {cost(spent)}</>}
          </>
        ) : (
          "Nothing yet."
        )}
      </p>
    </div>
  );
}

function Status({ record, now }: { record: GenRecord; now: number }) {
  const s = shown(record, now);
  return <span className={`admin-change ${tone(s)}`}>{STATUS_WORD[s]}</span>;
}

function Records({ records, now, users, kinds = false }: { records: GenRecord[]; now: number; users: Map<string, UserProfile> | null; kinds?: boolean }) {
  if (!records.length) return <p className="meta">Nothing yet.</p>;
  return (
    <div className="admin-scroll">
      <table className="admin-table admin-log">
        <thead>
          <tr>
            <th>When</th>
            <th className="admin-left">What</th>
            <th className="admin-left" title="Which of the ways this kind of request can go it was: a first or second go, which painter, in layers or by one painter...">Case</th>
            {users && <th className="admin-left">Who</th>}
            <th className="admin-left">Model</th>
            <th>Outcome</th>
            <th title="From the reader's side: time queued on their device plus time until the first of it arrived">First seen</th>
            <th title="From the reader's side: time queued on their device plus time until all of it arrived">Whole</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <th>
                <Link href={href({ id: r.id })}>
                  <When at={r.at} />
                </Link>
              </th>
              <td className="admin-left admin-what">
                <b>
                  {kinds ? `${KIND_ONE[r.kind]}: ` : ""}
                  {subOf(r)}
                </b>
                {r.what && <span> {r.what}</span>}
                {r.error && <span className="admin-error"> {r.error}</span>}
              </td>
              <td className="admin-left admin-case-cell">
                <Cases record={r} />
              </td>
              {users && <td className="admin-left">{r.userId ? <Link href={href({ user: r.userId })}>{who(users.get(r.userId), r.userId)}</Link> : "signed out"}</td>}
              <td className="admin-left admin-model">{models(r)}</td>
              <td>
                <Status record={r} now={now} />
              </td>
              <td>{dur(sawFirst(r))}</td>
              <td>{dur(sawAll(r))}</td>
              <td>{cost(r.usdMicro)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One request, in full. */
async function Detail({ id, now }: { id: string; now: number }) {
  const found = await getGen(id).catch(() => null);
  if (!found) notFound();
  const { record: r, result } = found;
  const user = r.userId ? await getUser(r.userId).catch(() => null) : null;
  // (a page's painting is kept as it was sent: the shapes alone, drawn on
  // the book's 400 by 300 sheet)
  const picture = !result
    ? null
    : /^\s*<svg[\s>]/.test(result)
      ? result
      : r.kind === "painting" && /^\s*</.test(result)
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${result}</svg>`
        : null;
  const rows: [string, ReactNode][] = [
    ["When", <When key="w" at={r.at} full />],
    [
      "Who",
      r.userId ? (
        <Link key="u" href={href({ user: r.userId })}>
          {who(user, r.userId)}
          {user?.username ? ` (${user.email})` : ""}
        </Link>
      ) : (
        "A signed-out reader"
      ),
    ],
    ["Case", <Cases key="c" record={r} />],
    ["Plan", r.tier ?? "-"],
    ["Outcome", <Status key="s" record={r} now={now} />],
    ...(r.error ? ([["What went wrong", r.error]] as [string, ReactNode][]) : []),
    ...(r.summary ? ([["What was made", r.summary]] as [string, ReactNode][]) : []),
    ["Queued on the reader's device", r.waitedMs == null ? "not reported (asked for at once)" : r.waitedMs < 50 ? "none (sent at once)" : dur(r.waitedMs)],
    ["Server: until the first of it was sent", dur(r.firstMs)],
    ["Server: until it ended", dur(r.totalMs)],
    ["Reader saw the first of it after", dur(sawFirst(r))],
    ["Reader had all of it after", dur(sawAll(r))],
    ["Size sent", r.size == null ? "-" : `${n(r.size)} ${r.kind === "voice" ? "bytes" : "characters"}`],
    ["Cost (estimate)", cost(r.usdMicro)],
    ...(r.storyId ? ([["Story", r.storyId]] as [string, ReactNode][]) : []),
    ...(r.http ? ([["Answered with", `HTTP ${r.http}`]] as [string, ReactNode][]) : []),
    ["Server region", r.region ?? "-"],
    ["Vercel request", r.vercelId ?? "-"],
    ["Browser", r.ua ?? "-"],
    ["Record", r.id],
  ];
  return (
    <div className="container admin">
      <header className="wizard-head">
        <p className="eyebrow">Only you can see this</p>
        <h1>
          {KIND_ONE[r.kind]}: {r.sub}
        </h1>
        {r.what && <p className="sub">{r.what}</p>}
      </header>
      <nav className="filter-row admin-pages" aria-label="Admin pages">
        <Link href="/admin" className="chip">
          Overall
        </Link>
        <Link href="/admin/activity" className="chip on" aria-current="page">
          User details
        </Link>
      </nav>
      <p className="meta admin-crumbs">
        <Link href={HERE}>Everyone&apos;s activity</Link>
        {r.userId && (
          <>
            {" · "}
            <Link href={href({ user: r.userId })}>{who(user, r.userId)}</Link>
          </>
        )}
      </p>
      {r.mock && (
        <p className="admin-note">
          <b>A stand-in.</b> No model key is set on this server, so this was made without calling a model.
        </p>
      )}

      <section className="admin-section">
        <h2>How it went</h2>
        <table className="admin-table admin-facts">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>
          Model calls <span className="admin-count">{r.calls.length}</span>
        </h2>
        {r.calls.length ? (
          <div className="admin-scroll">
            <table className="admin-table admin-log">
              <thead>
                <tr>
                  <th>Began</th>
                  <th className="admin-left">Call</th>
                  <th className="admin-left">Model</th>
                  <th>Taken up</th>
                  <th>First words</th>
                  <th>Ended</th>
                  <th>Tokens in / out</th>
                  <th>Cost</th>
                  <th className="admin-left">How it ended</th>
                </tr>
              </thead>
              <tbody>
                {r.calls.map((c, i) => (
                  <tr key={i}>
                    <th>+{dur(c.at - r.at)}</th>
                    <td className="admin-left">{c.label}</td>
                    <td className="admin-left admin-model">
                      {c.model}
                      {c.asked && c.asked !== c.model ? ` (asked for ${c.asked})` : ""}
                      {c.effort ? ` · effort ${c.effort}` : ""}
                      {c.thinking ? ` · thinking ${c.thinking}` : ""}
                    </td>
                    <td>{dur(c.acceptedMs)}</td>
                    <td>{dur(c.firstMs)}</td>
                    <td>{dur(c.totalMs)}</td>
                    <td>
                      {n(c.in + c.cacheRead + c.cacheWrite)} / {n(c.out)}
                      {c.cacheRead > 0 && <span className="admin-dim"> ({n(c.cacheRead)} cached)</span>}
                    </td>
                    <td>{cost(c.usdMicro)}</td>
                    <td className="admin-left admin-what">
                      {c.error ? <span className="admin-error">{c.error}</span> : (c.stop ?? "-")}
                      {c.http ? ` · HTTP ${c.http}` : ""}
                      {(c.requestId || c.messageId) && <span className="admin-dim"> {[c.requestId, c.messageId].filter(Boolean).join(" · ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="meta">{r.mock ? "None: a stand-in was used." : r.kind === "voice" ? "None: voices come from the speech service, not a Claude model." : "None were made."}</p>
        )}
      </section>

      <section className="admin-section">
        <h2>What was asked</h2>
        {r.request === undefined ? <p className="meta">Not kept.</p> : <pre className="admin-pre">{JSON.stringify(r.request, null, 2)}</pre>}
      </section>

      <section className="admin-section">
        <h2>What was made</h2>
        {result ? (
          <>
            {picture && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="admin-picture" alt="The painting as it was sent" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(picture)}`} />
            )}
            <pre className="admin-pre">{pretty(result)}</pre>
          </>
        ) : (
          <p className="meta">{r.kind === "voice" ? "Sound isn't kept, only its size." : r.status === "ok" ? "No longer kept (results are held for 14 days)." : "Nothing was made."}</p>
        )}
      </section>
    </div>
  );
}

const pretty = (s: string) => {
  if (!/^\s*[[{]/.test(s)) return s;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};
