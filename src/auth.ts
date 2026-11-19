import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedGoogleAccount, isViewerAccount } from "@/features/auth/allowlist";
import { readViewers } from "@/features/settings/data/viewer-access";

const sessionMaxAge = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: sessionMaxAge },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || profile?.email_verified !== true || typeof profile.email !== "string") return false;
      if (isAllowedGoogleAccount(profile.email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS)) return true;
      try { return isViewerAccount(profile.email, profile.email_verified, await readViewers()); }
      catch { return false; }
    },
    async jwt({ token }) {
      // Apply the new limit to tokens issued before the session duration changed.
      if (typeof token.iat === "number" && token.iat <= Math.floor(Date.now() / 1000) - sessionMaxAge) return null;
      if (isAllowedGoogleAccount(token.email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS)) return token;
      try { return isViewerAccount(token.email, true, await readViewers()) ? token : null; }
      catch { return null; }
    },
  },
});
