import { Suspense } from "react";
import { connection } from "next/server";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { FinanceDashboard } from "@/features/finance/components/finance-dashboard";

async function FinanceContent() {
  await connection();
  const [finance, operational] = await Promise.all([getFinanceData(), getDashboardData()]);
  return <FinanceDashboard finance={finance} operational={operational} />;
}
export default function FinancePage() {
  return <Suspense fallback={<DashboardLoading section="keuangan" />}><FinanceContent /></Suspense>;
}
