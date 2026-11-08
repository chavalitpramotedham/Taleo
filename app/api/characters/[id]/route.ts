import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteCharacter, updateCharacter } from "@/server/characters";

/** Rename a character and/or change its notes. Send only what changes. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: unknown; notes?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const notes = typeof body?.notes === "string" ? body.notes : body?.notes === null ? null : undefined;
  if (name !== undefined && !name) return NextResponse.json({ error: "Give them a name first." }, { status: 400 });
  if (name === undefined && notes === undefined) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    const character = await updateCharacter(session.user.id, id, { name, notes });
    return NextResponse.json({ character });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't update that character." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  await deleteCharacter(session.user.id, id);
  return NextResponse.json({ ok: true });
}
