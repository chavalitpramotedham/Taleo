import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listCharacters } from "@/server/characters";
import { characterLimit } from "@/lib/tiers";
import { MyCharacters } from "./MyCharacters";

/** Your characters, sent with the page itself: the roster is on screen as
 *  soon as the page is, rather than after the app has started and asked
 *  for it. */
export default async function MyCharactersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?next=/my-characters");
  const characters = await listCharacters(session.user.id).catch(() => null);
  const limit = characterLimit(session.user);
  return <MyCharacters initial={characters} initialLimit={Number.isFinite(limit) ? limit : null} />;
}
