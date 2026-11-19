import { Suspense } from "react";
import { connection } from "next/server";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { SourceStatus } from "@/features/dashboard/components/source-status";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFuelWithdrawals } from "@/features/dashboard/data/server/fuel-withdrawal-source";
import { defaultFilters } from "@/features/dashboard/lib/overview";
import { plot2026Worksheet } from "@/features/management/lib/plot-sheet";
import { plotWorksheetName } from "@/features/management/data/server/plot-sheet-source";
import Loading from "../../loading";

export const metadata = { title: "Dashboard Operasional" };

async function DashboardContent() {
  await connection();
  const [data, withdrawals] = await Promise.all([
    getDashboardData(),
    getFuelWithdrawals(),
  ]);
  if (data.kind === "error") {
    return (
      <main className="route-state">
        <h1>Sinkronisasi dashboard gagal</h1>
        <SourceStatus status={data.status} />
      </main>
    );
  }
  const initialFilters = { ...defaultFilters, startDate: "", endDate: "" };
  return (
    <Dashboard
      rows={data.rows}
      withdrawals={withdrawals}
      status={data.status}
      plotCodeMerges={data.plotCodeMerges}
      spkMerges={data.spkMerges}
      initialFilters={initialFilters}
      annualPlotPeriod={plotWorksheetName(process.env) === plot2026Worksheet}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardContent />
    </Suspense>
  );
}
