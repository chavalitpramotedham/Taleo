import { NextResponse } from "next/server";
import { reportError } from "@/server/alerts";

/** Errors from the app in people's browsers (see ErrorReporter). Limited
 *  per visitor, and the alerts themselves are throttled. */
const seen = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const now = Date.now();
  const recent = (seen.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return NextResponse.json({ ok: true });
  seen.set(ip, [...recent, now]);
  if (seen.size > 2000) seen.clear();

  const body = (await req.json().catch(() => null)) as { message?: unknown; stack?: unknown; page?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.slice(0, 400) : "";
  if (!message) return NextResponse.json({ ok: true });
  const err = new Error(message);
  err.stack = typeof body?.stack === "string" ? body.stack.slice(0, 2000) : "";
  await reportError("browser", err, {
    page: typeof body?.page === "string" ? body.page.slice(0, 200) : undefined,
    device: req.headers.get("user-agent")?.slice(0, 160) ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
