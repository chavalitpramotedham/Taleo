import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { addRating } from "@/server/gallery";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.username) {
    return NextResponse.json({ error: "Sign in and choose a username first." }, { status: 401 });
  }
  const { id } = await params;
  let body: { rating?: unknown; comment?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5." }, { status: 400 });
  }
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 500) : null;

  const result = await addRating(id, { id: session.user.id, username: session.user.username }, rating, comment);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(result);
}
