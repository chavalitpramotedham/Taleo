import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { AdminPages } from "./AdminPages";
import { listUsers } from "@/server/users";
import { listGallery } from "@/server/gallery";
import { activeUsersOver, metricsEnabled, readMetrics, type DayMetrics } from "@/server/metrics";
import { anthropicCosts, anthropicCostsEnabled, type AnthropicCosts } from "@/server/anthropic-costs";

export const metadata: Metadata = { title: "Admin dashboard", robots: { index: false, follow: false } };

const DAYS = 30;

const n = (v: number) => Math.round(v).toLocaleString("en-GB");
const usd = (v: number) => (v >= 100 ? `$${n(v)}` : `$${v.toFixed(2)}`);
const tokens = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : n(v));
const sum = (days: DayMetrics[], key: string) => days.reduce((t, d) => t + (d.counts[key] ?? 0), 0);
const avg = (e: { ratingSum: number; ratingCount: number }) => (e.ratingCount ? e.ratingSum / e.ratingCount : 0);

/** The platform owner's dashboard: users, what's being made, what it costs,
 *  and how the library is doing. Only the admin account can open it;
 *  everyone else gets a plain "not found". Always computed fresh. */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  const [users, gallery, metrics, active7, active30, costs] = await Promise.all([
    listUsers().catch(() => []),
    listGallery().catch(() => []),
    readMetrics(DAYS).catch((e) => (console.error("[admin] metrics", e), null)),
    activeUsersOver(7).catch(() => null),
    activeUsersOver(30).catch(() => null),
    anthropicCosts(DAYS).catch((e) => (console.error("[admin] costs", e), null as AnthropicCosts | null)),
  ]);

  const now = Date.now();
  const since = (days: number) => now - days * 86_400_000;
  const signups7 = users.filter((u) => u.createdAt >= since(7)).length;
  const signups30 = users.filter((u) => u.createdAt >= since(30)).length;
  const withUsername = users.filter((u) => u.username).length;

  const published30 = gallery.filter((e) => e.createdAt >= since(30)).length;
  const ratings = gallery.reduce((t, e) => t + (e.ratingCount || 0), 0);
  const ratingSum = gallery.reduce((t, e) => t + (e.ratingSum || 0), 0);
  const authors = new Map<string, number>();
  for (const e of gallery) authors.set(e.authorUsername || "taleo", (authors.get(e.authorUsername || "taleo") ?? 0) + 1);
  const topAuthors = [...authors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topStories = [...gallery].sort((a, b) => avg(b) - avg(a) || b.ratingCount - a.ratingCount).slice(0, 5);
  const categories = new Map<string, number>();
  for (const e of gallery) if (e.keyword) categories.set(e.keyword, (categories.get(e.keyword) ?? 0) + 1);

  const days = metrics?.days ?? [];
  const started = sum(days, "stories_started");
  const finished = sum(days, "stories_finished");
  const paintings = sum(days, "paintings");
  const features = ["story", "painting", "character"] as const;
  const featureCost = Object.fromEntries(features.map((f) => [f, sum(days, `${f}:usd_micro`) / 1e6])) as Record<(typeof features)[number], number>;
  const estTotal = features.reduce((t, f) => t + featureCost[f], 0);
  const totalIn = features.reduce((t, f) => t + sum(days, `${f}:in`) + sum(days, `${f}:cache_read`) + sum(days, `${f}:cache_write`), 0);
  const totalOut = features.reduce((t, f) => t + sum(days, `${f}:out`), 0);
  const cacheRead = features.reduce((t, f) => t + sum(days, `${f}:cache_read`), 0);
  const actualTotal = costs?.totalUsd ?? null;
  const spend = actualTotal ?? estTotal;
  const userName = new Map(users.map((u) => [u.id, u.username ? `@${u.username}` : u.email]));

  const perDay = days.map((d) => ({
    day: d.day,
    stories: d.counts.stories_started ?? 0,
    paintings: d.counts.paintings ?? 0,
    active: d.activeUsers,
    cost: costs?.days.find((c) => c.day === d.day)?.usd ?? features.reduce((t, f) => t + (d.counts[`${f}:usd_micro`] ?? 0) / 1e6, 0),
  }));
  // Daily series for the tiles' little charts (oldest first).
  const dayList = Array.from({ length: DAYS }, (_, i) => new Date(now - (DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  const endOf = (day: string) => Date.parse(`${day}T23:59:59.999Z`);
  const byDay = (key: string) => dayList.map((d) => days.find((x) => x.day === d)?.counts[key] ?? 0);
  const series = {
    accounts: dayList.map((d) => users.filter((u) => u.createdAt <= endOf(d)).length),
    active: dayList.map((d) => days.find((x) => x.day === d)?.activeUsers ?? 0),
    stories: byDay("stories_started"),
    library: dayList.map((d) => gallery.filter((e) => e.createdAt <= endOf(d)).length),
    cost: dayList.map((d) => costs?.days.find((c) => c.day === d)?.usd ?? features.reduce((t, f) => t + (days.find((x) => x.day === d)?.counts[`${f}:usd_micro`] ?? 0) / 1e6, 0)),
    paintings: byDay("paintings"),
    words: byDay("words"),
    tokens: dayList.map((d) => {
      const c = days.find((x) => x.day === d)?.counts ?? {};
      return features.reduce((t, f) => t + (c[`${f}:in`] ?? 0) + (c[`${f}:out`] ?? 0) + (c[`${f}:cache_read`] ?? 0) + (c[`${f}:cache_write`] ?? 0), 0);
    }),
  };
  const costPerStory = series.cost.map((c, i) => (series.stories[i] ? c / series.stories[i] : 0));
  const totalTokens = series.tokens.reduce((a, b) => a + b, 0);
  const maxCost = Math.max(0.01, ...perDay.map((d) => d.cost));
  const maxStories = Math.max(1, ...perDay.map((d) => d.stories));

  return (
    <div className="container admin">
      <header className="wizard-head">
        <p className="eyebrow">Only you can see this</p>
        <h1>Admin dashboard</h1>
        <p className="sub">The last {DAYS} days, unless it says otherwise. Updated each time you open it.</p>
      </header>

      <AdminPages on="overall" />

      {!metricsEnabled() && (
        <p className="admin-note">
          <b>Activity and token tracking is off.</b> Add Upstash Redis to the project (Vercel → Storage → Marketplace → Upstash for Redis, connected to <i>taleo</i>) and redeploy. Stories, paintings, words, tokens and cost per feature are recorded from then on.
        </p>
      )}
      {!anthropicCostsEnabled() && (
        <p className="admin-note">
          <b>Actual API costs aren&apos;t connected.</b> Create an Admin API key in the Claude Console (Settings → Admin keys) and add it as <code>ANTHROPIC_ADMIN_KEY</code> in Vercel. Until then, costs are estimates from token counts and list prices.
        </p>
      )}

      <section className="admin-section">
        <h2>At a glance</h2>
        <div className="admin-tiles">
          <Tile label="Accounts" value={n(users.length)} note={`+${signups7} this week · +${signups30} in 30 days`} data={series.accounts} />
          <Tile label="Active users" value={active7 === null ? "-" : n(active7)} note={active30 === null ? "needs tracking" : `this week · ${n(active30)} in 30 days`} data={metrics ? series.active : undefined} />
          <Tile label="Stories started" value={metrics ? n(started) : "-"} note={metrics ? `${n(finished)} finished (${started ? Math.round((finished / started) * 100) : 0}%)` : "needs tracking"} data={metrics ? series.stories : undefined} />
          <Tile label="In the library" value={n(gallery.length)} note={`+${published30} in 30 days`} data={series.library} />
          <Tile
            label={actualTotal !== null ? "API cost (actual)" : "API cost (estimate)"}
            value={usd(spend)}
            note={actualTotal !== null ? (metrics ? `estimate was ${usd(estTotal)}` : "Anthropic's report") : "from token counts"}
            data={metrics || costs ? series.cost : undefined}
            invert
          />
          <Tile label="Cost per story" value={started ? usd(spend / started) : "-"} note={paintings && started ? `${(paintings / started).toFixed(1)} paintings per story` : "per story started"} data={metrics ? costPerStory : undefined} invert />
          <Tile label="Paintings" value={metrics ? n(paintings) : "-"} note={metrics ? `${n(sum(days, "paintings_failed"))} failed` : "needs tracking"} data={metrics ? series.paintings : undefined} />
          <Tile label="Words written" value={metrics ? n(sum(days, "words")) : "-"} note={metrics ? `${n(sum(days, "pages"))} pages` : "needs tracking"} data={metrics ? series.words : undefined} />
          <Tile label="Tokens" value={metrics ? tokens(totalTokens) : "-"} note={!metrics ? "needs tracking" : totalIn ? `${Math.round((cacheRead / totalIn) * 100)}% from cache` : "none yet"} data={metrics ? series.tokens : undefined} invert />
        </div>
      </section>

      <section className="admin-section">
        <h2>Daily</h2>
        {perDay.length ? (
          <div className="admin-chart" role="img" aria-label="Cost and stories per day">
            {perDay.map((d) => (
              <div key={d.day} className="admin-bar-col" title={`${d.day}: ${usd(d.cost)}, ${d.stories} stories, ${d.paintings} paintings, ${d.active} active`}>
                <span className="admin-bar admin-bar-cost" style={{ height: `${(d.cost / maxCost) * 100}%` }} />
                <span className="admin-bar admin-bar-stories" style={{ height: `${(d.stories / maxStories) * 100}%` }} />
              </div>
            ))}
          </div>
        ) : costs ? (
          <div className="admin-chart" role="img" aria-label="Cost per day">
            {costs.days.map((d) => (
              <div key={d.day} className="admin-bar-col" title={`${d.day}: ${usd(d.usd)}`}>
                <span className="admin-bar admin-bar-cost" style={{ height: `${(d.usd / Math.max(0.01, ...costs.days.map((x) => x.usd))) * 100}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <p className="meta">Nothing recorded yet.</p>
        )}
        <p className="admin-legend">
          <span className="admin-key admin-key-cost" /> cost per day <span className="admin-key admin-key-stories" /> stories started (hover a day for details)
        </p>
      </section>

      <div className="admin-grid">
        <section className="admin-section">
          <h2>What was made</h2>
          <Table
            rows={[
              ["Stories started", metrics ? n(started) : "-"],
              ["Stories finished", metrics ? n(finished) : "-"],
              ["Story parts written", metrics ? n(sum(days, "segments")) : "-"],
              ["Pages written", metrics ? n(sum(days, "pages")) : "-"],
              ["Words written", metrics ? n(sum(days, "words")) : "-"],
              ["Paintings", metrics ? `${n(paintings)} (${n(sum(days, "paintings_quick"))} quick)` : "-"],
              ["Paintings that failed", metrics ? n(sum(days, "paintings_failed")) : "-"],
              ["Characters designed", metrics ? n(sum(days, "characters")) : "-"],
              ["Voice clips made", metrics ? `${n(sum(days, "tts_clips"))} (${n(sum(days, "tts_chars"))} characters)` : "-"],
              ["Voice clips from cache", metrics ? n(sum(days, "tts_cached")) : "-"],
            ]}
          />
        </section>

        <section className="admin-section">
          <h2>Tokens and cost by feature</h2>
          {metrics ? (
            <Table
              head={["", "Calls", "Input", "Output", "Est. cost"]}
              rows={[
                ...features.map((f) => [
                  f === "story" ? "Story writing" : f === "painting" ? "Paintings" : "Characters",
                  n(sum(days, `${f}:calls`)),
                  tokens(sum(days, `${f}:in`) + sum(days, `${f}:cache_read`) + sum(days, `${f}:cache_write`)),
                  tokens(sum(days, `${f}:out`)),
                  usd(featureCost[f]),
                ]),
                ["Total", "", tokens(totalIn), tokens(totalOut), usd(estTotal)],
              ]}
            />
          ) : (
            <p className="meta">Needs tracking (see above).</p>
          )}
          {metrics && totalIn > 0 && <p className="meta">{Math.round((cacheRead / totalIn) * 100)}% of input tokens were read from the prompt cache.</p>}
          {costs && Object.keys(costs.byModel).length > 0 && (
            <>
              <h3>Actual cost by model (Anthropic)</h3>
              <Table rows={Object.entries(costs.byModel).sort((a, b) => b[1] - a[1]).map(([m, v]) => [m, usd(v)])} />
            </>
          )}
        </section>

        <section className="admin-section">
          <h2>Unit economics</h2>
          <Table
            rows={[
              ["Cost per story started", started ? usd(spend / started) : "-"],
              ["Cost per finished story", finished ? usd(spend / finished) : "-"],
              ["Cost per painting (est.)", paintings ? usd(featureCost.painting / paintings) : "-"],
              ["Cost per active user (30 days)", active30 ? usd(spend / active30) : "-"],
              ["Stories per active user", active30 ? (started / active30).toFixed(1) : "-"],
              ["Accounts with a username", `${n(withUsername)} of ${n(users.length)}`],
              ["Published share of started stories", started ? `${Math.round((published30 / started) * 100)}%` : "-"],
              ["Revenue", "Not connected yet (Stripe, see roadmap)"],
            ]}
          />
        </section>

        <section className="admin-section">
          <h2>Biggest spenders this month (est.)</h2>
          {metrics?.topUsers.length ? (
            <Table rows={metrics.topUsers.map((u) => [userName.get(u.userId) ?? u.userId, usd(u.usdMicro / 1e6)])} />
          ) : (
            <p className="meta">{metrics ? "No AI use recorded this month yet." : "Needs tracking (see above)."}</p>
          )}
        </section>

        <section className="admin-section">
          <h2>Library</h2>
          <Table
            rows={[
              ["Stories", n(gallery.length)],
              ["Ratings", `${n(ratings)} (average ${ratings ? (ratingSum / ratings).toFixed(2) : "-"})`],
              ["Authors", n(authors.size)],
              ...[...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [`Category: ${k}`, n(v)] as [string, string]),
            ]}
          />
          <h3>Top authors</h3>
          <Table rows={topAuthors.map(([a, c]) => [`@${a}`, `${c} ${c === 1 ? "story" : "stories"}`])} />
          <h3>Top rated</h3>
          <Table rows={topStories.map((e) => [e.title || "Untitled", e.ratingCount ? `${avg(e).toFixed(1)} (${e.ratingCount})` : "unrated"])} />
        </section>

        <section className="admin-section">
          <h2>Elsewhere</h2>
          <ul className="admin-links">
            <li>
              <a href="/admin/activity">Activity</a>: every story, painting, character and voice clip as it was asked for - which model answered, how long the reader waited, and what went wrong. Search by email or handle.
            </li>
            <li>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel</a>: visitors and page views (Analytics), speed (Speed Insights), hosting and storage usage and bills.
            </li>
            <li>
              <a href="https://platform.claude.com/cost" target="_blank" rel="noreferrer">Claude Console</a>: API cost and usage in full, and spend limits.
            </li>
            <li>OpenAI dashboard: neural voice cost (voice characters are counted above).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/** A metric with a small, zoomed-out chart of its last 30 days - like a
 *  stock widget: a line with a soft fill, green when the second half of the
 *  period beats the first (red for costs, where up is worse). */
function Tile({ label, value, note, data, invert = false }: { label: string; value: string; note?: string; data?: number[]; invert?: boolean }) {
  let trend: "up" | "down" | "flat" = "flat";
  let change: string | null = null;
  if (data && data.length > 3) {
    const half = Math.floor(data.length / 2);
    const a = data.slice(0, half).reduce((x, y) => x + y, 0);
    const b = data.slice(half).reduce((x, y) => x + y, 0);
    if (b > a) trend = "up";
    else if (b < a) trend = "down";
    if (a > 0) change = `${b >= a ? "+" : ""}${Math.round(((b - a) / a) * 100)}%`;
  }
  const good = trend === "flat" ? "flat" : (trend === "up") !== invert ? "good" : "bad";
  return (
    <div className="admin-tile">
      <div className="admin-tile-head">
        <p className="admin-tile-label">{label}</p>
        {change && <span className={`admin-change ${good}`}>{change}</span>}
      </div>
      <p className="admin-tile-value">{value}</p>
      {data ? <Spark data={data} tone={good} /> : <div className="admin-spark admin-spark-empty" />}
      {note && <p className="admin-tile-note">{note}</p>}
    </div>
  );
}

function Spark({ data, tone }: { data: number[]; tone: "good" | "bad" | "flat" }) {
  const w = 120;
  const h = 34;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const id = `sp-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg className={`admin-spark ${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Table({ head, rows }: { head?: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <p className="meta">Nothing yet.</p>;
  return (
    <table className="admin-table">
      {head && (
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (j === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
