"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Info } from "lucide-react";
import type { DashboardFilters, RawOverviewRow } from "../types";
import type { DataSourceStatus } from "../data/source-types";
import { defaultFilters, filtersForPeriod } from "../lib/overview";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { readFilters, writeFilters } from "../lib/interactive-monitoring";
import { PlotDetail, PlotComparison } from "./plot-detail";
import { formatDate } from "../lib/format";
import { Filters } from "./filters";
import { KpiCards } from "./kpi-cards";
import { Charts } from "./charts";
import { PlotSummary } from "./plot-summary";
import { DataQuality } from "./data-quality";
import { SourceStatus } from "./source-status";

export function Dashboard({ rows, status, initialFilters = defaultFilters }: { rows: readonly RawOverviewRow[]; status: DataSourceStatus; initialFilters?: DashboardFilters }) {
  const [filters, setFilters] = useState(initialFilters);
  const [showAllPlots, setShowAllPlots] = useState(true);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  useEffect(() => {
    const restore = () => setFilters(readFilters(window.location.search, initialFilters));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [initialFilters]);
  function changeFilters(next: DashboardFilters) {
    setFilters(next);
    const search = writeFilters(window.location.search, next);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  }
  const worksheetName = status.worksheet ?? "Overview";
  const view = useMemo(() => buildDashboardViewModel(rows, filters, { worksheetName }), [rows, filters, worksheetName]);
  const { summary, plotCodes, periods } = view;
  const period = filters.startDate.slice(0, 7);
  const monthRange = periods.includes(period) ? filtersForPeriod(period) : null;
  const selectedPeriod = !filters.startDate && !filters.endDate ? "all" : monthRange && filters.startDate === monthRange.startDate && filters.endDate === monthRange.endDate ? period : "";
  function changePeriod(value: string) {
    const range = value === "all" ? { startDate: "", endDate: "" } : filtersForPeriod(value);
    changeFilters({ ...filters, startDate: range.startDate, endDate: range.endDate });
  }
  return <div className="dashboard-shell"><a className="skip-link" href="#main-content">Lewati ke dashboard</a>
    <header className="dashboard-header"><div className="header-copy"><h1>DASHBOARD MONITORING <em>PETAK &amp; SOLAR</em></h1><p>Produktivitas Alat <span>•</span> Konsumsi BBM <span>•</span> Progres Pekerjaan</p></div><label className="period-control"><CalendarDays size={30} aria-hidden="true" /><span><span className="period-label">Periode</span><select aria-label="Periode monitoring" value={selectedPeriod} onChange={(event) => changePeriod(event.target.value)}><option value="" disabled>Rentang khusus</option><option value="all">Semua tanggal</option>{periods.map((month) => <option key={month} value={month}>{formatDate(`${month}-01`, { month: "long", year: "numeric" })}</option>)}</select></span></label></header>
    <Filters value={filters} plotCodes={plotCodes} onChange={changeFilters} onReset={() => changeFilters(initialFilters)} isDemo={status.source === "mock"} />
    <main id="main-content" className="dashboard-main">
      {status.source === "mock" ? <div className="demo-notice"><Info size={16} aria-hidden="true" /><p><strong>Mode demonstrasi.</strong> Data sintetis Oktober 2026 untuk pratinjau dashboard, bukan pengukuran spreadsheet aktual.</p></div> : <SourceStatus status={status} />}
      <div className="section-heading"><h2>Ikhtisar Operasional</h2><span aria-live="polite">{view.filteredRecords.length} aktivitas <span className="heading-dot">·</span> {summary.plots.length} petak terpilih</span></div>
      <KpiCards totals={summary.totals} registeredCount={view.inventory.length} workedArea={view.workedArea} />
      {(summary.missingMeasurements > 0 || view.excludedRows > 0) && <p className="measurement-note" role="status">{summary.missingMeasurements > 0 && `${summary.missingMeasurements} aktivitas memiliki pengukuran belum lengkap atau perlu tinjauan. Total hanya mencakup nilai valid tersedia; efisiensi memakai pasangan solar dan HM yang valid.`} {view.excludedRows > 0 && `${view.excludedRows} baris tanpa kode petak/tanggal valid atau duplikat tidak disertakan.`}</p>}
      <Charts summary={summary} rows={view.filteredValidatedRecords} summaryPanel={<PlotSummary plots={view.visibleInventory} showAll={showAllPlots} onShowAllChange={setShowAllPlots} startDate={filters.startDate} endDate={filters.endDate} onSelect={setSelectedPlot} />} />
      {selectedPlot && view.inventory.find((plot) => plot.code === selectedPlot) && <PlotDetail plot={view.inventory.find((plot) => plot.code === selectedPlot)!} allRows={view.validatedRecords} periodRows={view.filteredValidatedRecords} issues={view.issues} onClose={() => setSelectedPlot(null)} />}
      <PlotComparison plots={view.inventory.filter((plot) => filters.plotCodes.includes(plot.code))} allRows={view.validatedRecords} periodRows={view.filteredValidatedRecords} />
      <DataQuality issues={view.issues} records={view.records} />
      <footer className="dashboard-footer"><span>Petak & Solar <span>·</span> Phase 4</span><span>{status.source === "mock" ? "Data demo statis" : `Worksheet ${worksheetName}`} <span>·</span> Asia/Makassar (WITA)</span></footer>
    </main></div>;
}
