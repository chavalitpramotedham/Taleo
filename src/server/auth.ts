import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUser, upsertFromGoogle } from "./users";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user, account }) {
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
      if (token.uid) {
        const profile = await getUser(token.uid as string);
        token.username = profile?.username ?? null;
        token.isAdmin = profile?.isAdmin ?? false;
        token.avatarKey = profile?.avatarKey ?? null;
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
