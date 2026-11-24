import { Suspense, type ReactNode } from "react";
import { LoginLink } from "@/features/auth/components/login-link";
import { connection } from "next/server";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { DashboardLoading, type LoadingLayout } from "@/components/layout/dashboard-loading";

async function Gate({ title, children }: { title: string; children: ReactNode }) {
  await connection();
  const configured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
  const session = configured ? await auth() : null;
  if (session?.user) return children;
  return <main className="directory-page settings-page"><header className="directory-heading"><div><span className="directory-eyebrow">MANAJEMEN DATA</span><h1>{title}</h1></div></header><section className="settings-panel settings-login-prompt" aria-labelledby="management-login-title"><span className="settings-source-icon"><LockKeyhole aria-hidden="true" /></span><h2 id="management-login-title">Masuk untuk membuka {title.toLowerCase()}</h2><p>Silakan masuk dengan akun Google untuk mengakses halaman ini.</p><LoginLink className={buttonVariants({ size: "lg" })}>Silakan masuk <ArrowRight aria-hidden="true" /></LoginLink></section></main>;
}

export function ManagementGate({ title, layout, children }: { title: string; layout: LoadingLayout; children: ReactNode }) {
  return <Suspense fallback={<DashboardLoading layout={layout} />}><Gate title={title}>{children}</Gate></Suspense>;
}
