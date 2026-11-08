"use client";
import { SessionProvider } from "next-auth/react";
import { NightModeProvider } from "./NightMode";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NightModeProvider>{children}</NightModeProvider>
    </SessionProvider>
  );
}
