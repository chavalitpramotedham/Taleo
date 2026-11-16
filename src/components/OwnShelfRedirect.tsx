"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/** On an author's bookshelf that turns out to be your own: on to "My
 *  bookshelf" instead, where your stories (and the one under way) are. */
export function OwnShelfRedirect({ username }: { username: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.user?.username?.toLowerCase();
  useEffect(() => {
    if (me && me === username.toLowerCase()) router.replace("/my-stories");
  }, [me, username, router]);
  return null;
}
