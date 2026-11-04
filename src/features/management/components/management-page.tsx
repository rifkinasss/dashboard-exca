import { Suspense } from "react";
import { connection } from "next/server";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { SourceStatus } from "@/features/dashboard/components/source-status";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import { buildManagementDirectory } from "../lib/build-management-directory";
import { getPlotDirectoryData } from "../data/server/plot-directory-source";
import { ManagementDirectory } from "./management-directory";

async function Content({ kind }: { kind: "petak" | "spk" }) {
  await connection();
  if (kind === "petak") {
    const result = await getPlotDirectoryData();
    if (result.kind === "error") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Data petak tidak ditampilkan karena sumber operasional belum berhasil dibaca.</p></main>;
    if (result.kind === "demo") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Halaman ini hanya menampilkan data sumber Google Sheets. Data demo tidak ditampilkan sebagai rekaman manajemen.</p></main>;
    return <main className="directory-main">{result.status.state !== "connected" && <SourceStatus status={result.status} />}<ManagementDirectory data={result.data} kind="petak" /></main>;
  }
  const operation = await getDashboardData();
  const finance = kind === "spk" ? await getFinanceData() : null;
  if (operation.kind === "error") return <main className="directory-page"><SourceStatus status={operation.status} /><p className="directory-notice">Data manajemen tidak ditampilkan karena sumber operasional belum berhasil dibaca.</p></main>;
  if (operation.status.source === "mock") return <main className="directory-page"><SourceStatus status={operation.status} /><p className="directory-notice">Halaman ini hanya menampilkan data sumber Google Sheets. Data demo tidak ditampilkan sebagai rekaman manajemen.</p></main>;

  const financeAvailable = kind === "spk" && finance?.kind === "ready";
  const financeRows = finance && finance.kind === "ready" ? finance.rows : [];
  const data = buildManagementDirectory(
    operation.rows,
    financeRows,
    {
      operationWorksheet: operation.status.worksheet ?? "Overview Operasional",
      operationSpkMerges: operation.spkMerges,
      operationPlotMerges: operation.plotCodeMerges,
      financeSpkMerges: finance && finance.kind === "ready" ? finance.spkMerges : [],
      financePlotMerges: finance && finance.kind === "ready" ? finance.plotCodeMerges : [],
      financeAvailable,
    },
  );
  return <main className="directory-main">
    <SourceStatus status={operation.status} />
    <ManagementDirectory data={data} kind={kind} financeAvailable={kind !== "spk" || financeAvailable} />
  </main>;
}

export function ManagementPage({ kind }: { kind: "petak" | "spk" }) {
  return <Suspense fallback={<DashboardLoading section={kind === "petak" ? "operasional" : "keuangan"} />}><Content kind={kind} /></Suspense>;
}
