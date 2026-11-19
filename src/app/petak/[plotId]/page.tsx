import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { SourceStatus } from "@/features/dashboard/components/source-status";
import { getPlotDirectoryData } from "@/features/management/data/server/plot-directory-source";
import { getFuelWithdrawals } from "@/features/dashboard/data/server/fuel-withdrawal-source";
import { getFuelPriceCatalog } from "@/features/dashboard/data/server/fuel-price-source";
import { selectPlotPurchases, summarizePlotPurchases } from "@/features/dashboard/lib/fuel-withdrawals";
import { PlotDetailPage } from "@/features/management/components/plot-detail-page";
import { getPlotPrices } from "@/features/management/data/server/plot-price-source";
import { calculatePlotPrice } from "@/features/management/lib/plot-price";
import { ManagementGate } from "@/features/auth/components/management-gate";
import { auth } from "@/auth";
import { isAdministrator } from "@/features/auth/server/permissions";
import { canInputTransactions } from "@/features/auth/allowlist";
import { readAccessUsers } from "@/features/settings/data/viewer-access";
import { plotWriterReady } from "@/features/management/data/server/plot-sheet-writer";
import { readSpkDocumentRecords, spkDocumentWriterReady } from "@/features/management/data/server/spk-document-source";

export const metadata = { title: "Detail Petak" };

async function PlotContent({ params }: { params: Promise<{ plotId: string }> }) {
  await connection();
  const { plotId } = await params;
  const [result, purchases, priceCatalog, plotPrices] = await Promise.all([getPlotDirectoryData(), getFuelWithdrawals(), getFuelPriceCatalog(), getPlotPrices()]);
  if (result.kind === "error") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Rincian petak tidak tersedia karena sumber operasional belum berhasil dibaca.</p></main>;
  if (result.kind === "demo") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Rincian petak hanya tersedia dari sumber Google Sheets; data demo tidak ditampilkan.</p></main>;
  const plot = result.data.plots.find((item) => item.id === plotId);
  if (!plot) notFound();
  const documentRecords = plot.spks.length ? await readSpkDocumentRecords().catch(() => null) : [];
  const spkDocuments = Object.fromEntries((documentRecords ?? []).filter((item) => plot.spks.includes(item.number)).map((item) => [item.number, item]));
  const plotPrice = calculatePlotPrice(plotPrices, plot, plot.usesOperationalPrice ? plot.operationalPricePerHa : undefined);
  const userEmail = (await auth())?.user?.email ?? null;
  const canWrite = Boolean(userEmail && await isAdministrator(userEmail));
  const canInput = Boolean(userEmail && (canWrite || await readAccessUsers().then((users) => canInputTransactions(userEmail, users)).catch(() => false)));
  const authReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return <main className="directory-main">{result.status.state !== "connected" && <SourceStatus status={result.status} />}<PlotDetailPage worksheet={result.status.worksheet} plot={plot} plotPrice={plotPrice} purchases={summarizePlotPurchases(purchases, plot.code)} purchaseRecords={selectPlotPurchases(purchases, plot.code)} priceCatalog={priceCatalog} plotCodes={result.data.plots.map((item) => item.code)} writerReady={plotWriterReady()} spkWriterReady={spkDocumentWriterReady()} canWrite={canWrite} canInput={canInput} authReady={authReady} userEmail={userEmail} spkDocuments={spkDocuments} spkDocumentsAvailable={documentRecords !== null} pickerApiKey={process.env.GOOGLE_PICKER_API_KEY ?? ""} cloudProjectNumber={process.env.GOOGLE_CLOUD_PROJECT_NUMBER ?? ""} cloudClientId={process.env.AUTH_GOOGLE_ID ?? ""} /></main>;
}

export default function PlotRoute({ params }: { params: Promise<{ plotId: string }> }) {
  return <ManagementGate title="Petak Lahan"><Suspense fallback={<DashboardLoading layout="detail" />}><PlotContent params={params} /></Suspense></ManagementGate>;
}
