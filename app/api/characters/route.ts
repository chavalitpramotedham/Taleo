import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { designCharacter, hasApiKey } from "@/server/claude";
import { mockCharacter } from "@/server/mock";
import { errorResponse } from "@/server/errors";
import { CharacterLimitError, listCharacters, saveCharacter, MAX_CHARACTERS } from "@/server/characters";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const characters = await listCharacters(session.user.id);
  return NextResponse.json({ characters });
}

/** Designs (via Claude, or the offline demo artist) and saves a new custom
 *  character to the signed-in user's roster. If they're already at the
 *  5-character cap, pass `replaceId` to overwrite one of their existing
 *  characters instead of adding a new one - the caller should check the
 *  `limitReached` flag first and let them pick which to replace, rather
 *  than spending a design call only to be told no. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { description?: unknown; name?: unknown; replaceId?: unknown } | null;
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : undefined;
  const replaceId = typeof body?.replaceId === "string" ? body.replaceId : undefined;
  if (!description) return NextResponse.json({ error: "Tell me about your character first!" }, { status: 400 });

  if (!replaceId) {
    const list = await listCharacters(session.user.id);
    if (list.length >= MAX_CHARACTERS) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_CHARACTERS} characters - replace one to add another.`, limitReached: true },
        { status: 409 },
      );
    }
  }

  try {
    const designed = hasApiKey() ? await designCharacter({ description, name }) : mockCharacter({ description, name });
    const { name: n, look, svg } = designed.character;
    const character = await saveCharacter(session.user.id, { name: n, look, svg: svg ?? null }, replaceId);
    return NextResponse.json({ character });
  } catch (err) {
    if (err instanceof CharacterLimitError) return NextResponse.json({ error: err.message, limitReached: true }, { status: 409 });
    return errorResponse(err);
  }
}
