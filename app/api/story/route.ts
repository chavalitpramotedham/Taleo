import { NextResponse } from "next/server";
import { generateSegment, hasApiKey } from "@/server/claude";
import { errorResponse } from "@/server/errors";
import { mockSegment } from "@/server/mock";
import { parseStoryRequest } from "@/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = parseStoryRequest(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "That story request looks incomplete." }, { status: 400 });

  if (!hasApiKey()) {
    await new Promise((r) => setTimeout(r, 900)); // let the loading animation breathe
    return NextResponse.json({ ...mockSegment(parsed), demo: true });
  }

  try {
    return NextResponse.json(await generateSegment(parsed));
  } catch (err) {
    return errorResponse(err);
  }
}

