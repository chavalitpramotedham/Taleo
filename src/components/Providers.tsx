"use client";
import { useEffect, useRef } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { NightModeProvider } from "./NightMode";
import { ErrorReporter } from "./ErrorReporter";
import dynamic from "next/dynamic";
import { EARLY_SIGNED_IN } from "@/lib/early";
import { forgetEverything } from "@/lib/remember";

// Asked only now and then (a draft to pick up, a finished story's next
// idea), so their code - and the character paintings they show - load
// after the page rather than with every page.
const DraftPrompt = dynamic(() => import("./DraftPrompt").then((m) => m.DraftPrompt), { ssr: false });
const NextAdventure = dynamic(() => import("./NextAdventure").then((m) => m.NextAdventure), { ssr: false });

/**
 * Two small notes kept about who is signed in:
 *  - on the device, whether anyone is - so the next page opened can ask
 *    for the account's own lists straight away (see lib/early);
 *  - and when the account changes, everything remembered from the last
 *    one is let go (see lib/remember).
 */
function WhoIsHere() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const last = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (status === "loading") return;
    try {
      if (userId) localStorage.setItem(EARLY_SIGNED_IN, "1");
      else localStorage.removeItem(EARLY_SIGNED_IN);
    } catch {}
    if (last.current !== undefined && last.current !== userId) forgetEverything();
    last.current = userId;
  }, [status, userId]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // No session re-check every time the tab regains focus: each one is a
    // server request, and the sign-in state rarely changes behind our back.
    <SessionProvider refetchOnWindowFocus={false}>
      <WhoIsHere />
      <ErrorReporter />
      <DraftPrompt />
      <NextAdventure />
      <NightModeProvider>{children}</NightModeProvider>
    </SessionProvider>
  );
}
