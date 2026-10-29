import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Petak & Solar | Dashboard Monitoring",
  description: "Monitoring petak, jam kerja excavator, dan konsumsi solar dengan sumber Google Sheets atau mode demo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="id"><body>{children}</body></html>;
}
