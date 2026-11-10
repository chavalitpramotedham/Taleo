import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUser, upsertFromGoogle } from "./users";
import { reportError } from "./alerts";

// Safety net: AUTH_URL must be a full address. Saved without its scheme
// (e.g. "taleo-stories.app") Auth.js crashes on every sign-in request, so
// add https:// if it's missing.
for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
  const v = process.env[key]?.trim();
  if (v && !/^https?:\/\//i.test(v)) process.env[key] = `https://${v.replace(/^\/+/, "")}`;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // Sign-in problems (misconfiguration, Google refusing) go to the dev inbox.
  logger: {
    error(error) {
      void reportError("sign-in", error);
    },
  },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      if (account && user) {
        const profile = await upsertFromGoogle({
          id: account.providerAccountId,
          email: user.email!,
          name: user.name ?? null,
          image: user.image ?? null,
        });
        token.uid = profile.id;
      }
      // Username can change after the token was minted (right after sign-up),
      // so always re-read it rather than trusting a stale cached value.
      // Re-read the profile only when it can have changed: at sign-in, when
      // the app asks (after a username or avatar change), while there's no
      // username yet (sign-up), or every 10 minutes - not on every request.
      // If it can't be read right now (a storage hiccup), keep what the
      // token already has rather than blanking the username and picture.
      const stale = Date.now() - ((token.profileAt as number | undefined) ?? 0) > 10 * 60 * 1000;
      if (token.uid && (account || trigger === "update" || !token.username || stale)) {
        const profile = await getUser(token.uid as string, { fresh: true }).catch(() => null);
        if (profile) {
          token.username = profile.username ?? null;
          token.isAdmin = profile.isAdmin ?? false;
          token.avatarKey = profile.avatarKey ?? null;
          token.profileAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.username = (token.username as string | null) ?? null;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.avatarKey = (token.avatarKey as string | null) ?? null;
      }
      return session;
    },
  },
});
