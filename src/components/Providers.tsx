"use client";
import { SessionProvider } from "next-auth/react";
import { NightModeProvider } from "./NightMode";
import { ErrorReporter } from "./ErrorReporter";
import { DraftPrompt } from "./DraftPrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // No session re-check every time the tab regains focus: each one is a
    // server request, and the sign-in state rarely changes behind our back.
    <SessionProvider refetchOnWindowFocus={false}>
      <ErrorReporter />
      <DraftPrompt />
      <NightModeProvider>{children}</NightModeProvider>
    </SessionProvider>
  );
}
