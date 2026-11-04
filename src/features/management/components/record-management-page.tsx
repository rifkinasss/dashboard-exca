import { Suspense } from "react";
import { connection } from "next/server";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { SourceStatus } from "@/features/dashboard/components/source-status";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { buildDashboardViewModel } from "@/features/dashboard/lib/build-dashboard-view-model";
import { defaultFilters } from "@/features/dashboard/lib/overview";
import { formatNumber } from "@/features/dashboard/lib/format";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import { normalizeFinance } from "@/features/finance/lib/normalize-finance";
import { relateFinance } from "@/features/finance/lib/relationships";
import { FinanceRecordDirectory } from "@/features/finance/components/finance-record-directory";
import { legacyPlotRouteId } from "../lib/plot-state";
import { getFuelWithdrawals } from "@/features/dashboard/data/server/fuel-withdrawal-source";
import { getFuelPriceCatalog } from "@/features/dashboard/data/server/fuel-price-source";
import { selectPlotPurchasesOnDate } from "@/features/dashboard/lib/fuel-withdrawals";
import { resolveWithdrawalPricing } from "@/features/dashboard/lib/fuel-price";
import { getPlotPrices } from "../data/server/plot-price-source";
import { buildManagementDirectory } from "../lib/build-management-directory";
import { RecordDirectory, type ManagedRecord, type ManagedRecordKind } from "./record-directory";

const allDates = { ...defaultFilters, startDate: "", endDate: "" };

function ManagementRecordRoute({ kind }: { kind: ManagedRecordKind }) {
  return <Suspense fallback={<DashboardLoading section={kind === "finance" ? "keuangan" : "operasional"} />}><RecordPageContent kind={kind} /></Suspense>;
}

async function RecordPageContent({ kind }: { kind: ManagedRecordKind }) {
  await connection();
  if (kind === "finance") {
    const data = await getFinanceData();
    if (!data) return <main className="directory-main"><div className="directory-notice">Sumber Finance tidak tersedia pada konfigurasi demo. Data sintetis tidak ditampilkan sebagai sumber produksi.</div></main>;
    if (data.kind === "error") return <main className="directory-main"><SourceStatus status={data.status} /><div className="directory-notice">Data keuangan tidak ditampilkan karena worksheet belum berhasil dibaca.</div></main>;
    const normalized = normalizeFinance(data.rows, { worksheet: data.status.worksheet ?? "Overview Finance", spkMerges: data.spkMerges, plotCodeMerges: data.plotCodeMerges });
    const [operation, purchases, priceCatalog, plotPrices] = await Promise.all([getDashboardData(), getFuelWithdrawals(), getFuelPriceCatalog(), getPlotPrices()]);
    const operationView = operation.kind === "ready" && operation.status.source === "google-sheets" ? buildDashboardViewModel(operation.rows, allDates, { worksheetName: operation.status.worksheet ?? "Overview Operasional", spkMerges: operation.spkMerges, plotCodeMerges: operation.plotCodeMerges }) : null;
    const eligibleRows = operationView ? relateFinance(normalized.records, operationView.validatedRecords).matched.map(({ record }) => record.row) : null;
    const plots = operation.kind === "ready" && operation.status.source === "google-sheets" ? buildManagementDirectory(operation.rows, [], { operationWorksheet: operation.status.worksheet ?? "Overview Operasional", operationSpkMerges: operation.spkMerges, operationPlotMerges: operation.plotCodeMerges }).plots.map(({ code, spks, area, areaRequiresReview, campaignRequiresReview }) => ({ code, spks, area, areaRequiresReview, campaignRequiresReview })) : [];
    return <main className="directory-main">{data.status.state !== "connected" && <SourceStatus status={data.status} />}<FinanceRecordDirectory records={normalized.records} eligibleRows={eligibleRows} purchases={purchases} priceCatalog={priceCatalog} plots={plots} plotPrices={plotPrices} /></main>;
  }

  const data = await getDashboardData();
  if (data.kind === "error") return <main className="directory-main"><SourceStatus status={data.status} /><div className="directory-notice">Data operasional tidak ditampilkan karena worksheet belum berhasil dibaca.</div></main>;
  if (data.status.source === "mock") return <main className="directory-main"><SourceStatus status={data.status} /><div className="directory-notice">Halaman manajemen hanya menampilkan sumber Google Sheets. Data demo tidak ditampilkan sebagai rekaman produksi.</div></main>;
  const view = buildDashboardViewModel(data.rows, allDates, { worksheetName: data.status.worksheet ?? "Overview Operasional", spkMerges: data.spkMerges, plotCodeMerges: data.plotCodeMerges });
  const issuesByRow = new Map<number, string[]>();
  for (const issue of view.issues) issuesByRow.set(issue.source.row, [...(issuesByRow.get(issue.source.row) ?? []), issue.message]);
  const records = view.records.filter((record) => record.raw.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
  const [purchases, priceCatalog] = kind === "activity" ? await Promise.all([getFuelWithdrawals(), getFuelPriceCatalog()]) : [null, null];
  const rows: ManagedRecord[] = kind === "activity"
    ? records.map((record) => {
      const issues = issuesByRow.get(record.source.row) ?? [];
      const details: [string, string][] = [["Tanggal aktivitas", record.date ?? ""], ["Kode petak", record.plotCode], ["Nomor SPK", record.spkNumber ?? ""], ["HM awal", show(record.hmStart)], ["HM akhir", show(record.hmEnd)], ["HM kerja", show(record.workingHours)], ["Estimasi jam kerja", show(record.estimatedWorkingHours)], ["Pengisian solar", show(record.fuelRefill)], ["Pemakaian solar riil", show(record.actualFuelUsage)], ["Status pekerjaan", record.workStatus ?? "Belum diketahui"], ["Keterangan", record.notes ?? ""], ["Baris sumber", String(record.source.row)]];
      const sameDayPurchases = purchases && record.date && record.plotCode ? { invalidRows: purchases.invalidRows.length, records: selectPlotPurchasesOnDate(purchases, record.plotCode, record.date).map((purchase) => ({ liters: purchase.liters, pricing: resolveWithdrawalPricing(purchase, priceCatalog) })) } : null;
      return { key: `${record.source.worksheet}-${record.source.row}`, primary: `Aktivitas · baris ${record.source.row}`, plot: record.plotCode, plotId: view.plotCodes.includes(record.plotCode) ? legacyPlotRouteId(record.plotCode) : undefined, spk: record.spkNumber ?? "", date: record.date ?? "", value: `HM ${show(record.workingHours)} jam · solar riil ${show(record.actualFuelUsage)} L`, status: record.workStatus ?? "Belum diketahui", search: [record.plotCode, record.spkNumber, record.notes, ...details.map(([, value]) => value), ...issues].join(" "), details, issues, sortValue: record.date, purchases: sameDayPurchases };
    })
    : records.filter((record) => record.cellStates.fuelRefill !== "missing").map((record) => {
      const issues = issuesByRow.get(record.source.row) ?? [];
      const rawRefill = record.cellStates.fuelRefill === "valid" ? `${formatNumber(record.fuelRefill)} L` : "Perlu tinjauan";
      const details: [string, string][] = [["Tanggal pengisian", "Tidak tersedia terpisah pada sumber"], ["Tanggal aktivitas sumber", record.date ?? ""], ["Kode petak", record.plotCode], ["Nomor SPK", record.spkNumber ?? ""], ["Pengisian solar", record.cellStates.fuelRefill === "valid" ? String(record.fuelRefill) : String(record.raw[10] ?? "")], ["Baris sumber", String(record.source.row)], ["Keterangan", record.notes ?? ""]];
      return { key: `${record.source.worksheet}-${record.source.row}`, primary: `Pengisian sumber · baris ${record.source.row}`, plot: record.plotCode, spk: record.spkNumber ?? "", date: record.date ?? "", value: rawRefill, status: "", search: [record.plotCode, record.spkNumber, record.notes, ...details.map(([, value]) => value), ...issues].join(" "), details, issues, sortValue: record.fuelRefill };
    });
  const plotCodes = view.plotCodes;
  const spkNumbers = view.spkOptions.map((item) => item.number);
  return <main className="directory-main">{(kind !== "activity" || data.status.state !== "connected") && <SourceStatus status={data.status} />}<RecordDirectory kind={kind} rows={rows} plotCodes={plotCodes} spkNumbers={spkNumbers} qualityCount={view.issues.length} /></main>;
}

function show(value: number | null) { return value === null ? "" : formatNumber(value); }

export { ManagementRecordRoute };
