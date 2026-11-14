import { InfoIcon, ReplayIcon } from "@/components/Icons";

/** Dev only: the admin menu's "what's live" row, both ways, to look at. */
export default function MarkerDev() {
  if (process.env.NODE_ENV !== "development") return null;
  const row = (update: boolean) => (
    <div className={`deploy-marker-row${update ? " has-refresh" : ""}`}>
      <button type="button" className="deploy-marker">
        <span className="deploy-marker-text">
          <span className="deploy-marker-version">
            <span className={`deploy-dot ${update ? "update" : "live"}`} aria-hidden />v1.4.6<code>7163de0</code>
          </span>
          <span className="deploy-marker-when">{update ? "Newer version live · reload" : "15 Nov, 02:10"}</span>
          <span className="deploy-marker-when deploy-marker-paint">
            Painting: <code>4-VT2Q</code> Natural limbs
          </span>
        </span>
        {!update && <InfoIcon />}
      </button>
      {update && (
        <button type="button" className="deploy-refresh" aria-label="Reload to get the newer version">
          <ReplayIcon />
        </button>
      )}
    </div>
  );
  return (
    <main style={{ display: "flex", gap: 40, padding: 40, flexWrap: "wrap" }}>
      {[false, true].map((u) => (
        <div key={String(u)} style={{ position: "relative", width: 260, height: 200 }}>
          <div className="account-dropdown" style={{ position: "static", display: "block" }}>
            {row(u)}
          </div>
        </div>
      ))}
    </main>
  );
}
