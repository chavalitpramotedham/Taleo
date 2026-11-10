import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      avatarKey: string | null;
      isAdmin: boolean;
      /** The plan this account is on (see lib/tiers). */
      tier: import("@/lib/tiers").TierId;
    } & DefaultSession["user"];
  }
}
