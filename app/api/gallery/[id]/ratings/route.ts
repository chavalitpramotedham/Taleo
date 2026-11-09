import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getGalleryStory, listRatings, myRating } from "@/server/gallery";

/** GET: the full list of who-rated-what-and-said-what — only the story's
 *  own creator (or the admin) can see this; everyone else just gets their
 *  own rating, so they can see what they previously rated. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const story = await getGalleryStory(id);
  if (!story) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ratings = await listRatings(id);
  // How many gave each number of stars (1-5) - for everyone, no names.
  const counts = [1, 2, 3, 4, 5].map((n) => ratings.filter((r) => r.rating === n).length);
  const isOwner = session?.user?.id && (session.user.id === story.authorId || session.user.isAdmin);
  if (isOwner) return NextResponse.json({ ratings, counts, mine: myRating(ratings, session!.user.id) });

  const mine = session?.user?.id ? myRating(ratings, session.user.id) : null;
  return NextResponse.json({ ratings: null, counts, mine });
}
