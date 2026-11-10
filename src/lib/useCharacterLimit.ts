"use client";
import { useSession } from "next-auth/react";
import { characterLimit } from "./tiers";

/** How many custom characters this account can keep (Infinity for the admin). */
export function useCharacterLimit(): number {
  const { data } = useSession();
  return characterLimit(data?.user);
}
