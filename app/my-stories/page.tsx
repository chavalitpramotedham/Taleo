import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listMyStories } from "@/server/gallery";
import { savedStories } from "@/server/saved";
import { MyStories } from "./MyStories";

/** Your bookshelf, sent with the page itself: your stories are on screen
 *  as soon as the page is, rather than after the app has started and
 *  asked for them. */
export default async function MyStoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?next=/my-stories");
  const [stories, saved] = await Promise.all([
    listMyStories(session.user.id).catch(() => null),
    savedStories(session.user.id).then((s) => s.stories).catch(() => null),
  ]);
  return <MyStories initialStories={stories} initialSaved={saved} />;
}
