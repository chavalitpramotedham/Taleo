import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listCharacters } from "@/server/characters";
import { CreateWizard } from "./CreateWizard";

/** The story wizard, with who's signed in and their characters sent with
 *  the page: the first step shows as soon as the page does, instead of
 *  after the app has started and checked. */
export default async function CreatePage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/sign-in?next=/create");
  if (!user.username) redirect("/welcome?next=/create");
  const characters = await listCharacters(user.id).catch(() => null);
  return <CreateWizard me={{ id: user.id, username: user.username }} initialCharacters={characters} />;
}
