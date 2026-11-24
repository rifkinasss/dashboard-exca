import { Suspense } from "react";
import { AccessPage } from "@/features/auth/components/access-page";
import { loginDestination } from "@/features/auth/login-destination";
import { DashboardLoading } from "@/components/layout/dashboard-loading";

export const metadata = { title: "Masuk" };

type LoginPageProps = { searchParams: Promise<{ error?: string; callbackUrl?: string }> };

async function LoginContent({ searchParams }: LoginPageProps) {
  const { error, callbackUrl } = await searchParams;
  const configured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
  return <AccessPage configured={configured} error={Boolean(error)} destination={loginDestination(callbackUrl)} />;
}

export default function LoginPage(props: LoginPageProps) {
  return <Suspense fallback={<DashboardLoading layout="login" />}><LoginContent {...props} /></Suspense>;
}
