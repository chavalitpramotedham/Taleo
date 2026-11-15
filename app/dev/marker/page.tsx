import { StorytellerSwitch } from "@/components/StorytellerSwitch";
import { BrushIcon, InfoIcon, QuillIcon, ReplayIcon } from "@/components/Icons";

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
          <span className="deploy-marker-when deploy-ai">
            <BrushIcon />
            <code>4-VT2Q</code>Sonnet 5.5
            <span className="deploy-effort"><i className="on" /><i className="on" /><i /></span>
          </span>
          <span className="deploy-marker-when deploy-ai">
            <QuillIcon />
            Sonnet 5.5
            <span className="deploy-effort"><i className="on" /><i className="on" /><i /></span>
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
            <StorytellerSwitch />
            {row(u)}
          </div>
        </div>
      ))}
    </main>
  );
}
