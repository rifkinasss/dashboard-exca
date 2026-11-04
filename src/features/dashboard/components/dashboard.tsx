"use client";

import { useEffect, useMemo, useState } from "react";
import { Construction, Info } from "lucide-react";
import type { DashboardFilters, PlotCodeMerge, RawOverviewRow } from "../types";
import type { DataSourceStatus } from "../data/source-types";
import { defaultFilters } from "../lib/overview";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { readFilters, writeFilters } from "../lib/interactive-monitoring";
import { PlotDetail } from "./plot-detail";
import { Filters } from "./filters";
import { KpiCards } from "./kpi-cards";
import { Charts } from "./charts";
import { PlotSummary } from "./plot-summary";
import { summarizeFuelWithdrawals, type FuelWithdrawalData } from "../lib/fuel-withdrawals";
import { SourceStatus } from "./source-status";

export function Dashboard({
  rows,
  withdrawals,
  status,
  plotCodeMerges,
  spkMerges,
  initialFilters = defaultFilters,
}: {
  rows: readonly RawOverviewRow[];
  withdrawals: FuelWithdrawalData | null;
  status: DataSourceStatus;
  plotCodeMerges?: readonly PlotCodeMerge[];
  spkMerges?: readonly PlotCodeMerge[];
  initialFilters?: DashboardFilters;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [showAllPlots, setShowAllPlots] = useState(true);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  useEffect(() => {
    const restore = () =>
      setFilters(readFilters(window.location.search, initialFilters));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [initialFilters]);
  function changeFilters(next: DashboardFilters) {
    setFilters(next);
    const search = writeFilters(window.location.search, next);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (
      url !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(null, "", url);
  }
  const worksheetName = status.worksheet ?? "Overview";
  const view = useMemo(
    () =>
      buildDashboardViewModel(rows, filters, {
        worksheetName,
        plotCodeMerges,
        spkMerges,
      }),
    [rows, filters, worksheetName, plotCodeMerges, spkMerges],
  );
  const { summary, plotCodes } = view;
  const withdrawalSummary = summarizeFuelWithdrawals(withdrawals, filters, plotCodes);
  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">
        Lewati ke dashboard
      </a>
      <header className="dashboard-header">
        <span className="dashboard-heading-icon"><Construction aria-hidden="true" /></span>
        <div className="header-copy">
          <h1>Dashboard Operasional</h1>
          <p>Produktivitas alat, konsumsi BBM, dan progres pekerjaan.</p>
        </div>
      </header>
      {status.source !== "mock" && status.state === "failed" && <SourceStatus status={status} compact />}
      <Filters
        value={filters}
        plotCodes={plotCodes}
        spkOptions={view.spkOptions}
        periods={view.periods}
        initialFilters={initialFilters}
        onChange={changeFilters}
        onReset={() => changeFilters(initialFilters)}
        isDemo={status.source === "mock"}
      />
      <main id="main-content" className="dashboard-main">
        {status.source === "mock" ? (
          <div className="demo-notice">
            <Info size={16} aria-hidden="true" />
            <p>
              <strong>Mode demonstrasi.</strong> Data sintetis Oktober 2026
              untuk pratinjau dashboard, bukan pengukuran spreadsheet aktual.
            </p>
          </div>
        ) : null}
        <div className="section-heading">
          <h2>Ikhtisar Operasional</h2>
          <span aria-live="polite">
            {view.filteredRecords.length} aktivitas{" "}
            <span className="heading-dot">·</span> {summary.plots.length} petak
            terpilih
          </span>
        </div>
        <KpiCards
          totals={summary.totals}
          withdrawals={withdrawalSummary}
          workedArea={view.workedArea}
          averageFuelPerHour={view.averageFuelPerHour}
          monthlyTarget={view.monthlyTarget}
          spkFiltered={filters.selectedSpkNumbers.length > 0}
        />
        {(summary.missingMeasurements > 0 || view.excludedRows > 0) && (
          <p className="measurement-note" role="status">
            {summary.missingMeasurements > 0 &&
              `${summary.missingMeasurements} aktivitas memiliki pengukuran belum lengkap atau perlu tinjauan. Total hanya mencakup nilai valid tersedia; efisiensi memakai pasangan solar dan HM yang valid.`}{" "}
            {view.excludedRows > 0 &&
              `${view.excludedRows} baris tanpa kode petak/tanggal valid atau duplikat tidak disertakan.`}
          </p>
        )}
        <Charts
          summary={summary}
          withdrawals={withdrawalSummary}
          rows={view.filteredValidatedRecords}
          inventory={view.inventory}
          summaryPanel={
            <PlotSummary
              plots={view.visibleInventory}
              showAll={showAllPlots}
              onShowAllChange={setShowAllPlots}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onSelect={setSelectedPlot}
            />
          }
        />
        {selectedPlot &&
          view.visibleInventory.find((plot) => plot.code === selectedPlot) && (
            <PlotDetail
              plot={
                view.visibleInventory.find(
                  (plot) => plot.code === selectedPlot,
                )!
              }
              allRows={view.scopedRecords}
              periodRows={view.filteredValidatedRecords}
              issues={view.issues}
              onClose={() => setSelectedPlot(null)}
            />
          )}
        <footer className="dashboard-footer">
          <span>
            Petak & Solar <span>·</span> Phase 4
          </span>
          <span>
            {status.source === "mock"
              ? "Data demo statis"
              : `Worksheet ${worksheetName}`}{" "}
            <span>·</span> Asia/Makassar (WITA)
          </span>
        </footer>
      </main>
    </div>
  );
}
