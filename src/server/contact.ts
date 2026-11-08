import type { ContactAttachment } from "@/lib/contact";
import { readJson, writeJson } from "./store";
import { reportError } from "./alerts";

/**
 * "Contact us" submissions. Every message is saved first (so nothing is
 * lost even if email isn't configured or fails), then emailed to the admin
 * inbox through Resend (https://resend.com).
 *
 * Environment:
 *   RESEND_API_KEY  - enables email. Without it, messages are only saved.
 *   CONTACT_EMAIL   - where messages go (default taleostories.dev@gmail.com).
 *   CONTACT_FROM    - sender. Default "Taleo <onboarding@resend.dev>", which
 *                     Resend only lets you send to the email address that owns
 *                     the Resend account - so sign up to Resend with the
 *                     CONTACT_EMAIL address, or verify your own domain there
 *                     and set this to e.g. "Taleo <hello@yourdomain.com>".
 */

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "taleostories.dev@gmail.com";
const CONTACT_FROM = process.env.CONTACT_FROM || "Taleo <onboarding@resend.dev>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export interface ContactMessage {
  id: string;
  createdAt: number;
  title: string;
  message: string;
  attachments: ContactAttachment[];
  from: { userId: string; username: string | null; email: string; name: string | null };
  emailed: boolean;
}

const INDEX = "contact/index.json";

export async function saveContactMessage(msg: ContactMessage) {
  await writeJson(`contact/messages/${msg.id}.json`, msg);
  const index = (await readJson<{ id: string; createdAt: number; title: string; emailed: boolean }[]>(INDEX)) ?? [];
  const entry = { id: msg.id, createdAt: msg.createdAt, title: msg.title, emailed: msg.emailed };
  await writeJson(INDEX, [entry, ...index.filter((e) => e.id !== msg.id)].slice(0, 1000));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Total size of files to attach to the email itself (the rest are links). */
const ATTACH_BUDGET = 15 * 1024 * 1024;

/** Emails a saved message to the admin inbox. Returns false (never throws)
 *  if email isn't configured or the send fails. */
export async function emailContactMessage(msg: ContactMessage): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.info(`[contact] RESEND_API_KEY not set - message ${msg.id} saved but not emailed.`);
    return false;
  }
  const who = `${msg.from.username ? `@${msg.from.username}` : msg.from.name || "A reader"} (${msg.from.email})`;
  const files = msg.attachments
    .map((a) =>
      a.url
        ? `<li><a href="${esc(a.url)}">${esc(a.name)}</a> · ${esc(a.type)} · ${mb(a.size)}</li>`
        : `<li>${esc(a.name)} · ${mb(a.size)} (stored locally only)</li>`,
    )
    .join("");
  const html = `<div style="font-family:Georgia,serif;color:#3b3127;max-width:640px">
<h2 style="margin:0 0 4px">${esc(msg.title)}</h2>
<p style="margin:0 0 16px;color:#6b5a48">From ${esc(who)} · ${new Date(msg.createdAt).toUTCString()}</p>
<div style="white-space:pre-wrap;font-size:16px;line-height:1.5">${esc(msg.message)}</div>
${files ? `<h3 style="margin:20px 0 6px">Attachments</h3><ul>${files}</ul>` : ""}
<p style="margin-top:24px;color:#9a8a74;font-size:13px">Message id ${esc(msg.id)} · reply to this email to answer them directly.</p>
</div>`;

  // Attach files to the email too while they fit; larger ones stay as links.
  let budget = ATTACH_BUDGET;
  const attachments = msg.attachments
    .filter((a) => a.url && a.size <= budget && (budget -= a.size) >= 0)
    .map((a) => ({ filename: a.name, path: a.url! }));

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_EMAIL],
        reply_to: msg.from.email,
        subject: `[Taleo] ${msg.title}`,
        html,
        attachments: attachments.length ? attachments : undefined,
      }),
    });
    if (!res.ok) await reportError("contact email", new Error(`Resend refused message ${msg.id}: ${res.status} ${await res.text()}`));
    return res.ok;
  } catch (e) {
    await reportError("contact email", e, { message: msg.id });
    return false;
  }
}
