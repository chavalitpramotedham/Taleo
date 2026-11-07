import { NextResponse } from "next/server";
import { rateStory } from "@/server/gallery";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { rating?: unknown; previousRating?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5." }, { status: 400 });
  }
  let previousRating: number | undefined;
  if (body.previousRating != null) {
    const p = Number(body.previousRating);
    if (!Number.isInteger(p) || p < 0 || p > 5) return NextResponse.json({ error: "Bad previous rating." }, { status: 400 });
    previousRating = p;
  }

  const entry = await rateStory(id, rating, previousRating);
  if (!entry) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ entry });
}
