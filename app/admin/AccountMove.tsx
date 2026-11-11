"use client";
import { useEffect, useState } from "react";
import type { MoveStatus } from "@/server/account-move";

type Reply = { status?: MoveStatus; error?: string; copied?: { profiles: { copied: number }; records: { copied: number } }; retired?: { removed: number } };

/** The move of account records out of the public file store (see
 *  server/account-move): where it has got to, and the admin's two steps.
 *  Once the public files are gone there is nothing left to do here, and
 *  this is one quiet line. */
export function AccountMove() {
  const [status, setStatus] = useState<MoveStatus | null>(null);
  const [busy, setBusy] = useState<"copy" | "retire" | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/account-move")
      .then((r) => r.json() as Promise<Reply>)
      .then((r) => (r.status ? setStatus(r.status) : setSaid(r.error ?? "Couldn't check.")))
      .catch(() => setSaid("Couldn't check."));
  }, []);

  async function run(step: "copy" | "retire") {
    if (step === "retire" && !window.confirm("Remove the old public files of account records? Everything in them has been copied to the private store. This can't be undone.")) return;
    setBusy(step);
    setSaid(null);
    try {
      const res = await fetch("/api/admin/account-move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, confirm: step === "retire" }) });
      const r = (await res.json()) as Reply;
      if (r.status) setStatus(r.status);
      if (r.error) setSaid(r.error);
      else if (r.copied) setSaid(`Copied ${r.copied.profiles.copied} profile${r.copied.profiles.copied === 1 ? "" : "s"} and ${r.copied.records.copied} other record${r.copied.records.copied === 1 ? "" : "s"} that weren't across yet.`);
      else if (r.retired) setSaid("The public files have been removed.");
    } catch {
      setSaid("That didn't go through. It's safe to try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!status) return said ? <p className="admin-note">{said}</p> : null;
  if (!status.available) {
    return (
      <p className="admin-note">
        <b>Account records have nowhere private to live.</b> Connect Upstash Redis to the project (Vercel → Storage) and redeploy: sign-in needs it.
      </p>
    );
  }
  if (status.retired) return said ? <p className="admin-note">{said} Account records are kept privately ({status.privateProfiles} profiles).</p> : null;
  const ready = status.publicProfiles !== null && status.missing === 0;
  return (
    <div className="admin-note">
      <p>
        <b>Account records are moving to the private store.</b> {status.privateProfiles} profile{status.privateProfiles === 1 ? " is" : "s are"} there now
        {status.publicProfiles === null ? "; the old public file couldn't be read just now." : `; the old public file still holds ${status.publicProfiles}${status.missing ? ` (${status.missing} not copied yet)` : ""}.`}{" "}
        Copy everything across, then remove the public files - until then, anyone who worked out their address could read them.
      </p>
      <p>
        <button type="button" className="btn btn-soft btn-sm" disabled={busy !== null} onClick={() => run("copy")}>
          {busy === "copy" ? "Copying…" : "1. Copy everything across"}
        </button>{" "}
        <button type="button" className="btn btn-soft btn-sm" disabled={busy !== null || !ready} onClick={() => run("retire")}>
          {busy === "retire" ? "Removing…" : "2. Remove the public files"}
        </button>
      </p>
      {said && <p role="status">{said}</p>}
    </div>
  );
}
