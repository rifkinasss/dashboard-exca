import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedGoogleAccount } from "@/features/auth/allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && isAllowedGoogleAccount(profile?.email, profile?.email_verified, process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
    },
  },
});
