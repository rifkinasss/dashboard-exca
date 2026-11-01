import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <><Suspense fallback={<header className="app-header" aria-label="Navigasi dashboard" />}><DashboardHeader /></Suspense>{children}</>;
}
