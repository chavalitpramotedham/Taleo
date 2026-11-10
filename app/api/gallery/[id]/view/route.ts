import { NextResponse } from "next/server";
import { pickDay } from "@/lib/daily";
import { noteView } from "@/server/views";

/** A reader opened this library story (sent once per reader, story and
 *  day by the story's page): counted towards the story of the day, for
 *  the date where the reader is. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  noteView(pickDay(new URL(req.url).searchParams.get("day")), id);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
