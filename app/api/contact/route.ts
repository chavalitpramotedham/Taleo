import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { emailContactMessage, saveContactMessage, type ContactMessage } from "@/server/contact";
import {
  CONTACT_MAX_FILES,
  CONTACT_MAX_FILE_MB,
  CONTACT_MESSAGE_MAX,
  CONTACT_TITLE_MAX,
  isMediaType,
  type ContactAttachment,
} from "@/lib/contact";

export const runtime = "nodejs";

/** Tells the page how to upload attachments: straight to blob storage in
 *  production, or through the local fallback route in development. */
export async function GET() {
  return NextResponse.json({ directUpload: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}

const isOurBlob = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith("/contact/");
  } catch {
    return false;
  }
};

// Each message sends an email (Resend's free plan allows 100 a day) and
// saves files, so a person can send a handful an hour - plenty for real
// feedback, and a stop on anything stuck in a loop or scripted.
const SENT = new Map<string, number[]>();
const PER_HOUR = 5;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Please sign in to send us a message." }, { status: 401 });
  }
  const now = Date.now();
  const recent = (SENT.get(session.user.id) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= PER_HOUR && !session.user.isAdmin) {
    return NextResponse.json({ error: "Thanks for all the messages! Please try again in a little while." }, { status: 429 });
  }
  SENT.set(session.user.id, [...recent, now]);
  const body = (await req.json().catch(() => null)) as { title?: unknown; message?: unknown; attachments?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, CONTACT_TITLE_MAX) : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, CONTACT_MESSAGE_MAX) : "";
  if (!title) return NextResponse.json({ error: "Please add a title." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Please write a message." }, { status: 400 });

  const attachments: ContactAttachment[] = (Array.isArray(body?.attachments) ? body.attachments : [])
    .slice(0, CONTACT_MAX_FILES)
    .map((a) => (a ?? {}) as Record<string, unknown>)
    .map((a) => ({
      name: typeof a.name === "string" ? a.name.slice(0, 200) : "file",
      type: typeof a.type === "string" ? a.type.slice(0, 100) : "",
      size: typeof a.size === "number" && a.size > 0 ? Math.min(a.size, CONTACT_MAX_FILE_MB * 1024 * 1024) : 0,
      // Only links to files uploaded through our own upload route.
      url: typeof a.url === "string" && isOurBlob(a.url) ? a.url : null,
    }))
    .filter((a) => isMediaType(a.type));

  const msg: ContactMessage = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    title,
    message,
    attachments,
    from: { userId: session.user.id, username: session.user.username ?? null, email: session.user.email, name: session.user.name ?? null },
    emailed: false,
  };
  try {
    await saveContactMessage(msg);
  } catch (e) {
    console.error("[contact] couldn't save message", e);
    return NextResponse.json({ error: "Couldn't send your message just now. Please try again." }, { status: 500 });
  }
  msg.emailed = await emailContactMessage(msg);
  if (msg.emailed) await saveContactMessage(msg).catch(() => {});
  return NextResponse.json({ ok: true, id: msg.id });
}
