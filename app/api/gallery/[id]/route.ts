import { NextResponse } from "next/server";
import { getGalleryStory } from "@/server/gallery";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id);
  if (!story) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ story }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
}
