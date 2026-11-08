import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { errorResponse } from "@/server/errors";
import { CharacterLimitError, listCharacters, saveCharacter, MAX_CHARACTERS } from "@/server/characters";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const characters = await listCharacters(session.user.id);
  return NextResponse.json({ characters });
}

/** Saves a character the caller has already designed and previewed (via
 *  POST /api/character, which never persists anything on its own) to the
 *  signed-in user's roster - confirming a preview never redesigns it, so
 *  what gets saved is exactly what they looked at. If they're already at
 *  the 5-character cap, pass `replaceId` to overwrite one of their
 *  existing characters instead of adding a new one - the caller should
 *  check the `limitReached` flag first and let them pick which to
 *  replace, rather than finding out only after confirming. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { character?: { name?: unknown; look?: unknown; svg?: unknown }; replaceId?: unknown }
    | null;
  const name = typeof body?.character?.name === "string" ? body.character.name.trim() : "";
  const look = typeof body?.character?.look === "string" ? body.character.look : "";
  const svg = typeof body?.character?.svg === "string" ? body.character.svg : null;
  const replaceId = typeof body?.replaceId === "string" ? body.replaceId : undefined;
  if (!name) return NextResponse.json({ error: "That character needs a name first." }, { status: 400 });

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
    const character = await saveCharacter(session.user.id, { name, look, svg }, replaceId);
    return NextResponse.json({ character });
  } catch (err) {
    if (err instanceof CharacterLimitError) return NextResponse.json({ error: err.message, limitReached: true }, { status: 409 });
    return errorResponse(err);
  }
}
