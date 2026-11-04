import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
import "@/components/layout/app-shell.css";

const title = "Excavator Management System";
const description = "Dashboard Monitoring Petak & Solar serta keuangan operasional excavator.";
const siteUrl = process.env.SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Excavator Management System",
  title,
  description,
  openGraph: { title, description, siteName: "Excavator Management System", locale: "id_ID", type: "website" },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const configuredTtl = Number(process.env.SHEETS_CACHE_TTL_SECONDS ?? "60");
  const refreshSeconds = Number.isSafeInteger(configuredTtl) && configuredTtl > 0 ? Math.max(10, configuredTtl) : 60;
  return <html lang="id"><body><Suspense fallback={children}><AppShell refreshSeconds={refreshSeconds}>{children}</AppShell></Suspense></body></html>;
}
