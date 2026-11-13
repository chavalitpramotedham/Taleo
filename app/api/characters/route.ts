import { after, NextResponse } from "next/server";
import { prepareParts } from "@/server/paint/parts-maker";
import { reuseOf } from "@/server/claude";
import { auth } from "@/server/auth";
import { errorResponse } from "@/server/errors";
import { CharacterLimitError, listCharacters, reorderCharacters, saveCharacter } from "@/server/characters";
import { characterLimit, tierFor } from "@/lib/tiers";
import { whoIs } from "@/server/limits";

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
    | { character?: { name?: unknown; look?: unknown; svg?: unknown; notes?: unknown; relationships?: unknown; gender?: unknown; prompt?: unknown }; replaceId?: unknown }
    | null;
  const name = typeof body?.character?.name === "string" ? body.character.name.trim() : "";
  const look = typeof body?.character?.look === "string" ? body.character.look : "";
  const svg = typeof body?.character?.svg === "string" ? body.character.svg : null;
  const notes = typeof body?.character?.notes === "string" ? body.character.notes : null;
  const relationships = typeof body?.character?.relationships === "string" ? body.character.relationships : null;
  const gender = typeof body?.character?.gender === "string" ? body.character.gender : null;
  const prompt = typeof body?.character?.prompt === "string" ? body.character.prompt : null;
  const replaceId = typeof body?.replaceId === "string" ? body.replaceId : undefined;
  if (!name) return NextResponse.json({ error: "That character needs a name first." }, { status: 400 });

  // (the plan as the records have it now: a move up or down shows at once)
  const me = await whoIs(session).catch(() => null);
  const who = me?.user ?? session.user;
  const limit = characterLimit(who);
  if (!replaceId) {
    const list = await listCharacters(session.user.id);
    if (list.length >= limit) {
      return NextResponse.json(
        { error: `On the ${tierFor(who).name} plan you can keep ${limit} custom characters - replace one to add another.`, limitReached: true },
        { status: 409 },
      );
    }
  }

  try {
    const character = await saveCharacter(session.user.id, { name, look, svg, notes, relationships, gender, prompt }, replaceId, limit);
    // With characters painted from their parts switched on, a new or
    // repainted character's parts are made now, in the background - not
    // on the first page that needs them, where they'd hold the picture up.
    if (reuseOf({}).parts && svg) after(() => prepareParts({ id: "hero", name, look, svg, preset: null }).catch(() => {}));
    return NextResponse.json({ character });
  } catch (err) {
    if (err instanceof CharacterLimitError) return NextResponse.json({ error: err.message, limitReached: true }, { status: 409 });
    return errorResponse(err);
  }
}

/** A new order for the roster: { order: [characterId, ...] }, first to last. */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { order?: unknown } | null;
  const order = Array.isArray(body?.order) ? body.order.filter((x): x is string => typeof x === "string").slice(0, 200) : null;
  if (!order) return NextResponse.json({ error: "Missing order." }, { status: 400 });
  try {
    const characters = await reorderCharacters(session.user.id, order);
    return NextResponse.json({ characters });
  } catch (err) {
    return errorResponse(err);
  }
}
