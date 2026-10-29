import nextEnv from "@next/env";
import source from "../.test-build/data/server/dashboard-source.js";
import engine from "../.test-build/lib/build-dashboard-view-model.js";
import filters from "../.test-build/lib/overview.js";

nextEnv.loadEnvConfig(process.cwd());
const data = await source.getDashboardData();
if (data.status.source !== "google-sheets") {
  console.log(JSON.stringify({ liveVerification: "NOT_ATTEMPTED", source: data.status.source }));
  process.exitCode = 1;
} else if (data.kind === "error") {
  console.log(JSON.stringify({ liveVerification: "FAILED", status: data.status }, null, 2));
  process.exitCode = 1;
} else {
  const view = engine.buildDashboardViewModel(data.rows, { ...filters.defaultFilters, startDate: "", endDate: "" }, { worksheetName: data.status.worksheet ?? "Overview" });
  const problematic = new Set(view.issues.filter((issue) => issue.severity !== "info").map((issue) => issue.source.row));
  const periods = Object.fromEntries(view.periods.map((period) => {
    const periodView = engine.buildDashboardViewModel(data.rows, filters.filtersForPeriod(period), { worksheetName: data.status.worksheet ?? "Overview" });
    return [period, { activePlotCodes: periodView.summary.plots.map((plot) => plot.code), activityRows: periodView.filteredRecords.length, kpis: periodView.summary.totals }];
  }));
  console.log(JSON.stringify({
    liveVerification: view.filteredRecords.length >= 2 ? "READ_AND_PIPELINE_VERIFIED" : "READ_VERIFIED_INSUFFICIENT_VALID_ROWS",
    status: data.status,
    rowCount: data.rows.length,
    eligibleRows: view.filteredRecords.length,
    rowsWithoutWarningOrError: view.records.length - problematic.size,
    problematicRows: problematic.size,
    dataQualityIssues: view.issues.length,
    issuesBySeverity: Object.fromEntries([...Map.groupBy(view.issues, (issue) => issue.severity)].map(([severity, issues]) => [severity, issues.length])),
    issuesByCode: Object.fromEntries([...Map.groupBy(view.issues, (issue) => issue.code)].map(([code, issues]) => [code, issues.length])),
    issuesByCodeAndField: Object.fromEntries([...Map.groupBy(view.issues, (issue) => `${issue.code}:${issue.field ?? "row"}`)].map(([code, issues]) => [code, issues.length])),
    registeredPlotCodes: view.plotCodes,
    plotsWithoutDatedActivity: view.inventory.filter((plot) => !plot.hasActivity).map((plot) => plot.code),
    plotMetadata: view.inventory.map((plot) => ({ code: plot.code, area: plot.areaMetadata, cumulativeFuel: plot.cumulativeFuelMetadata })),
    dashboardPeriod: "Semua tanggal",
    dashboardKpis: view.summary.totals,
    periods,
  }, null, 2));
  if (view.filteredRecords.length < 2) process.exitCode = 1;
}
