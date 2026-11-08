import { NextResponse } from "next/server";
import { designCharacter, hasApiKey } from "@/server/claude";
import { mockCharacter } from "@/server/mock";
import { errorResponse } from "@/server/errors";
import { guard } from "@/server/limits";
import { count, withMetricsUser } from "@/server/metrics";

export const runtime = "nodejs";
// High-effort character design can take a couple of minutes.
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { description?: unknown; name?: unknown } | null;
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : undefined;
  if (!description) return NextResponse.json({ error: "Tell me about your character first!" }, { status: 400 });
  const g = await guard("character");
  if (!g.ok) return g.response;

  if (!hasApiKey()) return NextResponse.json(mockCharacter({ description, name }));
  try {
    const made = await withMetricsUser(g.session.user.id, () => designCharacter({ description, name }));
    withMetricsUser(g.session.user.id, () => count({ characters: 1 }));
    return NextResponse.json(made);
  } catch (err) {
    await g.release();
    return errorResponse(err);
  }
}
