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

async function PlotContent({ params }: { params: Promise<{ plotId: string }> }) {
  await connection();
  const { plotId } = await params;
  const [result, purchases, priceCatalog, plotPrices] = await Promise.all([getPlotDirectoryData(), getFuelWithdrawals(), getFuelPriceCatalog(), getPlotPrices()]);
  if (result.kind === "error") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Rincian petak tidak tersedia karena sumber operasional belum berhasil dibaca.</p></main>;
  if (result.kind === "demo") return <main className="directory-page"><SourceStatus status={result.status} /><p className="directory-notice">Rincian petak hanya tersedia dari sumber Google Sheets; data demo tidak ditampilkan.</p></main>;
  const plot = result.data.plots.find((item) => item.id === plotId);
  if (!plot) notFound();
  return <main className="directory-main">{result.status.state !== "connected" && <SourceStatus status={result.status} />}<PlotDetailPage plot={plot} plotPrice={calculatePlotPrice(plotPrices, plot)} purchases={summarizePlotPurchases(purchases, plot.code)} purchaseRecords={selectPlotPurchases(purchases, plot.code)} priceCatalog={priceCatalog} plotCodes={result.data.plots.map((item) => item.code)} spkNumbers={result.data.spks.map((item) => item.number)} /></main>;
}

export default function PlotRoute({ params }: { params: Promise<{ plotId: string }> }) {
  return <Suspense fallback={<DashboardLoading layout="detail" />}><PlotContent params={params} /></Suspense>;
}
