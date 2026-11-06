import { NextResponse } from "next/server";
import { designCharacter, hasApiKey } from "@/server/claude";
import { mockCharacter } from "@/server/mock";
import { errorResponse } from "@/server/errors";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { description?: unknown; name?: unknown } | null;
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : undefined;
  if (!description) return NextResponse.json({ error: "Tell me about your character first!" }, { status: 400 });

  if (!hasApiKey()) return NextResponse.json(mockCharacter({ description, name }));
  try {
    return NextResponse.json(await designCharacter({ description, name }));
  } catch (err) {
    return errorResponse(err);
  }
}
