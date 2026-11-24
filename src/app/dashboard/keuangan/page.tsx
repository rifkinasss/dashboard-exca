import { Suspense } from "react";
import { connection } from "next/server";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import { financeWorksheetName } from "@/features/finance/types";
import { getAnnualPlotSource } from "@/features/management/data/server/plot-directory-source";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { FinanceDashboard } from "@/features/finance/components/finance-dashboard";

export const metadata = { title: "Dashboard Keuangan" };

async function FinanceContent() {
  await connection();
  const annual = financeWorksheetName(process.env.GOOGLE_FINANCE_SHEET_NAME) === "Overview Finance"
    ? getAnnualPlotSource()
    : Promise.resolve(null);
  const [finance, operational] = await Promise.all([
    getFinanceData(),
    annual.then((source) => source ?? getDashboardData()),
  ]);
  return <FinanceDashboard finance={finance} operational={operational} />;
}
export default function FinancePage() {
  return <Suspense fallback={<DashboardLoading layout="finance-dashboard" />}><FinanceContent /></Suspense>;
}
