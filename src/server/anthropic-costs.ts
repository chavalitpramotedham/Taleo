/**
 * Anthropic's own record of what the API actually cost, per day and per
 * model - the authoritative number to check the dashboard's estimates
 * against. Needs an Admin API key (sk-ant-admin..., made by an organisation
 * admin in the Claude Console) in ANTHROPIC_ADMIN_KEY; without one the
 * dashboard simply leaves this section out.
 *
 * Covers the whole organisation (or the workspace in
 * ANTHROPIC_WORKSPACE_ID, if Noomi has its own). Data appears within
 * about five minutes; results are cached for ten.
 */

const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY || "";
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || "";
export const anthropicCostsEnabled = () => Boolean(ADMIN_KEY);

export interface AnthropicCosts {
  /** USD per UTC day (YYYY-MM-DD), oldest first. */
  days: { day: string; usd: number }[];
  /** USD per model over the period. */
  byModel: Record<string, number>;
  totalUsd: number;
}

interface CostReport {
  data: { starting_at: string; ending_at: string; results: { amount: string; currency: string; model: string | null; workspace_id: string | null }[] }[];
  has_more: boolean;
  next_page: string | null;
}

export async function anthropicCosts(days = 30): Promise<AnthropicCosts | null> {
  if (!ADMIN_KEY) return null;
  const start = new Date(Date.now() - (days - 1) * 86_400_000);
  start.setUTCHours(0, 0, 0, 0);
  const out: AnthropicCosts = { days: [], byModel: {}, totalUsd: 0 };
  let page: string | null = null;
  for (let guard = 0; guard < 5; guard++) {
    const q = new URLSearchParams({ starting_at: start.toISOString(), limit: "31" });
    q.append("group_by[]", "description");
    if (WORKSPACE) q.append("group_by[]", "workspace_id");
    if (page) q.set("page", page);
    const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, {
      headers: { "x-api-key": ADMIN_KEY, "anthropic-version": "2026-10-21", "User-Agent": "Noomi/1.0 (https://taleo-stories.app)" },
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`cost report ${res.status}`);
    const report = (await res.json()) as CostReport;
    for (const bucket of report.data) {
      let usd = 0;
      for (const r of bucket.results) {
        if (WORKSPACE && r.workspace_id !== WORKSPACE) continue;
        // amounts are in cents, as decimal strings
        const v = Number(r.amount) / 100 || 0;
        usd += v;
        const m = r.model || "other";
        out.byModel[m] = (out.byModel[m] ?? 0) + v;
      }
      out.days.push({ day: bucket.starting_at.slice(0, 10), usd });
      out.totalUsd += usd;
    }
    if (!report.has_more || !report.next_page) break;
    page = report.next_page;
  }
  return out;
}
