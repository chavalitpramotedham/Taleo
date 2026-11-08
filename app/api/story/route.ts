import { NextResponse } from "next/server";
import { generateSegment, hasApiKey } from "@/server/claude";
import { errorResponse } from "@/server/errors";
import { mockSegment } from "@/server/mock";
import { parseStoryRequest } from "@/server/validate";
import { auth } from "@/server/auth";
import { guard, isUnlimited, LIMIT_MESSAGES, minutesText, peekLimit } from "@/server/limits";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Can the signed-in user begin a new story right now? (Checked by the
 *  setup wizard before it creates the story, so nobody ends up with an
 *  empty draft when they've hit the limit.) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ canStart: false, error: "Please sign in to make stories." }, { status: 401 });
  if (isUnlimited(session)) return NextResponse.json({ canStart: true, retryAfterSec: 0 });
  const { ok, retryAfterSec } = await peekLimit(session.user.id, "story");
  return NextResponse.json({
    canStart: ok,
    retryAfterSec,
    error: ok ? undefined : LIMIT_MESSAGES.story(minutesText(retryAfterSec)),
  });
}

export async function POST(req: Request) {
  const parsed = parseStoryRequest(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "That story request looks incomplete." }, { status: 400 });

  // A new story uses the 1-per-30-minutes allowance; continuing one already
  // started uses the (generous) segment cap.
  const g = await guard(parsed.kind === "start" ? "story" : "segment");
  if (!g.ok) return g.response;

  if (!hasApiKey()) {
    await new Promise((r) => setTimeout(r, 900)); // let the loading screen breathe
    return NextResponse.json({ ...mockSegment(parsed), demo: true });
  }
  try {
    return NextResponse.json(await generateSegment(parsed));
  } catch (err) {
    await g.release(); // a story that failed to write doesn't count
    return errorResponse(err);
  }
}
