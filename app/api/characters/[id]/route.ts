import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { deleteCharacter, renameCharacter } from "@/server/characters";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give them a name first." }, { status: 400 });
  try {
    const character = await renameCharacter(session.user.id, id, name);
    return NextResponse.json({ character });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't rename that character." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  await deleteCharacter(session.user.id, id);
  return NextResponse.json({ ok: true });
}
