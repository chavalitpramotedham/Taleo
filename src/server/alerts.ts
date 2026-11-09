/**
 * Developer error alerts: emails the dev inbox when something goes wrong in
 * production, so outages are noticed straight away rather than by hand.
 *
 * Environment:
 *   DEV_ALERT_EMAIL  - where alerts go (default taleostories.dev@gmail.com)
 *   RESEND_API_KEY   - needed to send (same key as the contact form)
 *   CONTACT_FROM     - sender (same as the contact form)
 *
 * Kept quiet on purpose: the same error is sent at most once every 30
 * minutes, and no more than 20 alerts an hour (per server instance), so a
 * burst can't flood the inbox or the email allowance. Only production
 * deployments send; everywhere else it just logs.
 */

const TO = process.env.DEV_ALERT_EMAIL || "taleostories.dev@gmail.com";
const FROM = process.env.CONTACT_FROM || "Taleo <onboarding@resend.dev>";
const KEY = process.env.RESEND_API_KEY;
const LIVE = process.env.VERCEL_ENV === "production";

const SAME_ERROR_MS = 30 * 60 * 1000;
const PER_HOUR = 20;
const lastSent = new Map<string, number>();
let hourStart = 0;
let sentThisHour = 0;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Errors that aren't problems: a reader leaving mid-request, etc. */
function ignorable(err: unknown) {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  return name === "AbortError" || /aborted|The operation was aborted|NEXT_REDIRECT|NEXT_NOT_FOUND/i.test(msg);
}

/** Reports an error by email (throttled). Never throws. */
export async function reportError(where: string, err: unknown, details: Record<string, string | undefined> = {}) {
  try {
    if (ignorable(err)) return;
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 12).join("\n") : "";
    console.error(`[alert] ${where}: ${message}`);
    if (!LIVE || !KEY) return;

    const now = Date.now();
    const sig = `${where}|${message.slice(0, 120)}`;
    if (now - (lastSent.get(sig) ?? 0) < SAME_ERROR_MS) return;
    if (now - hourStart > 60 * 60 * 1000) {
      hourStart = now;
      sentThisHour = 0;
    }
    if (sentThisHour >= PER_HOUR) return;
    lastSent.set(sig, now);
    sentThisHour++;

    const rows = Object.entries(details)
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td style="color:#8a7a68;padding-right:12px">${esc(k)}</td><td>${esc(String(v))}</td></tr>`)
      .join("");
    const html = `<div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#3b3127">
<p style="font-family:Georgia,serif;font-size:16px;margin:0 0 8px"><b>${esc(where)}</b> failed on taleo-stories.app</p>
<p style="margin:0 0 10px;font-size:14px">${esc(message)}</p>
<table style="margin:0 0 10px">${rows}<tr><td style="color:#8a7a68;padding-right:12px">when</td><td>${new Date(now).toUTCString()}</td></tr></table>
${stack ? `<pre style="background:#f6f1e6;padding:10px;white-space:pre-wrap">${esc(stack)}</pre>` : ""}
<p style="color:#9a8a74;font-size:12px">The same error won't be emailed again for 30 minutes.</p></div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [TO], subject: `[Taleo alert] ${where}: ${message.slice(0, 90)}`, html }),
    });
  } catch (e) {
    console.error("[alert] couldn't send an alert", e);
  }
}
