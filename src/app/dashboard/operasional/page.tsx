import { Suspense } from "react";
import { connection } from "next/server";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { SourceStatus } from "@/features/dashboard/components/source-status";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { defaultFilters } from "@/features/dashboard/lib/overview";
import Loading from "../../loading";

async function DashboardContent() {
  await connection();
  const [data] = await Promise.all([
    getDashboardData(),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
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
      status={data.status}
      plotCodeMerges={data.plotCodeMerges}
      spkMerges={data.spkMerges}
      initialFilters={initialFilters}
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
