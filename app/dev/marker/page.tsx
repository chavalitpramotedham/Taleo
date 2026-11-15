import { StorytellerSwitch } from "@/components/StorytellerSwitch";
import { BrushIcon, InfoIcon, QuillIcon, ReplayIcon } from "@/components/Icons";

/** Dev only: the foot of the admin's menu (the version, then painting and
 *  storytelling, then the storyteller switch), both ways, to look at. */
export default function MarkerDev() {
  if (process.env.NODE_ENV !== "development") return null;
  const foot = (update: boolean, fast: boolean) => (
    <>
      <div className={`deploy-marker-row${update ? " has-refresh" : ""}`}>
        <button type="button" className="deploy-marker">
          <span className="deploy-marker-text">
            <span className="deploy-marker-version">
              <span className={`deploy-dot ${update ? "update" : "live"}`} aria-hidden />v1.4.21<code>d76ea7e</code>
            </span>
            <span className="deploy-marker-when">{update ? "Newer version live · reload" : "15 Nov, 11:43"}</span>
          </span>
          {!update && <InfoIcon />}
        </button>
        {update && (
          <button type="button" className="deploy-refresh" aria-label="Reload to get the newer version">
            <ReplayIcon />
          </button>
        )}
      </div>
      <div className="deploy-ai-block">
        <span className="deploy-marker-when deploy-ai">
          <BrushIcon />
          <code>4-VT2Q</code>Sonnet 5.5
          <span className="deploy-effort"><i className="on" /><i className="on" /><i /></span>
        </span>
        <span className="deploy-marker-when deploy-ai">
          <QuillIcon />
          {fast ? "Opus 5.5" : "Sonnet 5.5"}
          <span className="deploy-effort"><i className="on" />{fast ? <i /> : <i className="on" />}<i /></span>
          {fast && <span className="deploy-fast">fast</span>}
        </span>
      </div>
      <StorytellerSwitch />
    </>
  );
  return (
    <main style={{ display: "flex", gap: 40, padding: 40, flexWrap: "wrap", alignItems: "flex-start" }}>
      {[[false, false], [true, true]].map(([u, f]) => (
        <div key={`${u}${f}`} className="account-dropdown admin" style={{ position: "static" }}>
          <p className="account-dropdown-name">@admin</p>
          <span className="account-dropdown-item">Sign out</span>
          {foot(u, f)}
        </div>
      ))}
      <div className="account-dropdown admin" style={{ position: "static" }}>
        <p className="account-dropdown-name">@admin</p>
        <span className="account-dropdown-item">Sign out</span>
        <div className="deploy-skeleton">
          <div className="deploy-marker-row">
            <p className="deploy-marker">
              <span className="deploy-marker-text">
                <span className="deploy-marker-version"><span className="deploy-skel" style={{ width: 118 }} />{"\u200b"}</span>
                <span className="deploy-marker-when"><span className="deploy-skel" style={{ width: 84 }} />{"\u200b"}</span>
              </span>
              <InfoIcon />
            </p>
          </div>
          <div className="deploy-ai-block">
            <span className="deploy-marker-when deploy-ai"><span className="deploy-skel" style={{ width: 132 }} />{"\u200b"}</span>
            <span className="deploy-marker-when deploy-ai"><span className="deploy-skel" style={{ width: 96 }} />{"\u200b"}</span>
          </div>
        </div>
        <StorytellerSwitch />
      </div>
    </main>
  );
}
