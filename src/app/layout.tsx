import type { Metadata } from "next";
import "./globals.css";

const title = "Petak & Solar | Dashboard Monitoring";
const description = "Pantau produktivitas excavator, konsumsi solar, dan keuangan petak dalam satu dashboard.";
const siteUrl = process.env.SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { title, description, siteName: "Petak & Solar", locale: "id_ID", type: "website" },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="id"><body>{children}</body></html>;
}
