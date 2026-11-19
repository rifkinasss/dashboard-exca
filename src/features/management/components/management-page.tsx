import { Suspense } from "react";
import { connection } from "next/server";
import { auth } from "@/auth";
import { isAdministrator } from "@/features/auth/server/permissions";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { SourceStatus } from "@/features/dashboard/components/source-status";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import { buildManagementDirectory } from "../lib/build-management-directory";
import { getPlotDirectoryData } from "../data/server/plot-directory-source";
import { ManagementDirectory } from "./management-directory";
import { plotWriterReady } from "../data/server/plot-sheet-writer";
import { readSpkDocumentRecords, spkDocumentWriterReady } from "../data/server/spk-document-source";

async function Content({ kind }: { kind: "petak" | "spk" }) {
  await connection();
  if (kind === "petak") {
    const result = await getPlotDirectoryData();
    if (result.kind === "error") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Data petak tidak ditampilkan karena sumber operasional belum berhasil dibaca.</p></main>;
    if (result.kind === "demo") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Halaman ini hanya menampilkan data sumber Google Sheets. Data demo tidak ditampilkan sebagai rekaman manajemen.</p></main>;
    const userEmail = (await auth())?.user?.email ?? null;
    const canWrite = Boolean(userEmail && await isAdministrator(userEmail));
    const authReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
    return <main className="directory-main">{result.status.state !== "connected" && <SourceStatus status={result.status} />}<ManagementDirectory data={result.data} kind="petak" writerReady={plotWriterReady()} canWrite={canWrite} authReady={authReady} userEmail={userEmail} /></main>;
  }
  const operation = await getDashboardData();
  const [finance, documentRecords] = kind === "spk" ? await Promise.all([getFinanceData(), readSpkDocumentRecords().catch(() => null)]) : [null, null];
  if (operation.kind === "error") return <main className="directory-page"><SourceStatus status={operation.status} /><p className="directory-notice">Data manajemen tidak ditampilkan karena sumber operasional belum berhasil dibaca.</p></main>;
  if (operation.status.source === "mock") return <main className="directory-page"><SourceStatus status={operation.status} /><p className="directory-notice">Halaman ini hanya menampilkan data sumber Google Sheets. Data demo tidak ditampilkan sebagai rekaman manajemen.</p></main>;

  const financeAvailable = kind === "spk" && finance?.kind === "ready";
  const userEmail = (await auth())?.user?.email ?? null;
  const canWrite = Boolean(userEmail && await isAdministrator(userEmail));
  const authReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const spkDocuments = Object.fromEntries((documentRecords ?? []).map((record) => [record.number, record]));
  const financeRows = finance && finance.kind === "ready" ? finance.rows : [];
  const data = buildManagementDirectory(
    operation.rows,
    financeRows,
    {
      operationWorksheet: operation.status.worksheet ?? "Overview Operasional",
      operationSpkMerges: operation.spkMerges,
      operationPlotMerges: operation.plotCodeMerges,
      financeWorksheet: finance && finance.kind === "ready" ? finance.status.worksheet ?? "Overview Finance" : undefined,
      financeSpkMerges: finance && finance.kind === "ready" ? finance.spkMerges : [],
      financePlotMerges: finance && finance.kind === "ready" ? finance.plotCodeMerges : [],
      financeAvailable,
    },
  );
  return <main className="directory-main">
    <SourceStatus status={operation.status} />
    <ManagementDirectory data={data} kind={kind} financeAvailable={kind !== "spk" || financeAvailable} canWrite={canWrite} authReady={authReady} writerReady={spkDocumentWriterReady()} pickerApiKey={process.env.GOOGLE_PICKER_API_KEY ?? ""} cloudProjectNumber={process.env.GOOGLE_CLOUD_PROJECT_NUMBER ?? ""} cloudClientId={process.env.AUTH_GOOGLE_ID ?? ""} spkDocuments={spkDocuments} spkDocumentsAvailable={documentRecords !== null} />
  </main>;
}

export function ManagementPage({ kind }: { kind: "petak" | "spk" }) {
  return <Suspense fallback={<DashboardLoading layout="directory" />}><Content kind={kind} /></Suspense>;
}
