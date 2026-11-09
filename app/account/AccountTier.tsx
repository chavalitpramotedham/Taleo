import { CrownMark, MapleMark } from "@/components/Icons";
import { TIERS, tierFor, type TierInfo } from "@/lib/tiers";

/** Account tier: the plan you're on (Free, with the maple leaf, or Admin,
 *  with the crown) and everything it allows - then every plan side by
 *  side, including the behind-the-scenes safety limits, and a note that
 *  more plans are on the way. */
export function AccountTier({ isAdmin }: { isAdmin: boolean }) {
  const tier = tierFor(isAdmin);
  // Everyone sees the Free plan's terms; the admin also sees their own.
  const plans: TierInfo[] = isAdmin ? [TIERS.free, TIERS.admin] : [TIERS.free];
  const labels = [...new Set(plans.flatMap((p) => p.rows.map((r) => r.label)))];
  const capLabels = plans[0].caps.map((c) => c.label);
  const valueOf = (p: TierInfo, label: string, list: "rows" | "caps") => p[list].find((r) => r.label === label)?.value ?? "—";

  return (
    <section className="panel account-tier">
      <h3>Account tier</h3>
      <div className={`tier-card tier-${tier.id}`}>
        <span className="tier-badge" aria-hidden>
          {tier.id === "admin" ? <CrownMark /> : <MapleMark />}
        </span>
        <div className="tier-card-text">
          <p className="tier-name">{tier.name}</p>
          <p className="meta">{tier.blurb}</p>
        </div>
      </div>
      <ul className="tier-rows">
        {tier.rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <b>{r.value}</b>
          </li>
        ))}
      </ul>

      <details className="tier-details">
        <summary>Every plan&apos;s limits</summary>
        <div className="tier-table-wrap">
          <table className="tier-table">
            <thead>
              <tr>
                <th scope="col" />
                {plans.map((p) => (
                  <th key={p.id} scope="col">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {plans.map((p) => (
                    <td key={p.id}>{valueOf(p, label, "rows")}</td>
                  ))}
                </tr>
              ))}
              <tr className="tier-table-group">
                <th scope="row" colSpan={plans.length + 1}>
                  Safety limits
                  <span className="meta"> - far above normal use; they only stop automated misuse</span>
                </th>
              </tr>
              {capLabels.map((label) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {plans.map((p) => (
                    <td key={p.id}>{valueOf(p, label, "caps")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="tier-coming">
        <span className="tier-coming-pill">Coming soon</span> More plans, with more stories and characters, are on their way.
      </p>
    </section>
  );
}
