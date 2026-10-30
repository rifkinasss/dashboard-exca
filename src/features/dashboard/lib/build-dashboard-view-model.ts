import { workStatuses, type DashboardFilters, type DashboardSummary, type ProcessingOptions, type RawOverviewRow } from "../types";
import { normalizeOverview, validDate } from "./normalize-overview";
import { validateOverview } from "./validate-overview";
import { defaultFilters, filterOverview } from "./overview";
import { aggregateByPlot } from "./aggregate-by-plot";
import { aggregateDailyTrend } from "./aggregate-daily-trend";
import { calculateKpis, measurement, sumMeasured } from "./calculate-kpis";
import { buildPlotInventory } from "./plot-inventory";

export function buildDashboardViewModel(rawRows: readonly RawOverviewRow[], filters: DashboardFilters = defaultFilters, options: ProcessingOptions = {}) {
  const normalized = normalizeOverview(rawRows, options);
  const validated = validateOverview(normalized.records, options);
  const filtered = filterOverview(validated.records, filters, options.sheetOrderConfirmed);
  const datedRows = filterOverview(validated.records, { ...filters, statuses: [] }, options.sheetOrderConfirmed);
  const periodPlots = aggregateByPlot(filtered, options.sheetOrderConfirmed);
  const inventory = buildPlotInventory(validated.records, periodPlots, datedRows, filters, options.sheetOrderConfirmed);
  const inventoryByCode = new Map(inventory.map((plot) => [plot.code, plot]));
  const recordsByRow = new Map(normalized.records.map((record) => [record.source.row, record]));
  const areaValues = inventory.filter((plot) => plot.includedActivity).map((plot) => {
    if (plot.area !== null) return plot.area;
    const candidates = plot.areaMetadata.sourceRows.map((source) => recordsByRow.get(source.row));
    return candidates.length > 0 && candidates.every((record) => record?.cellStates.plotArea === "valid" && record.plotArea === 0) ? 0 : null;
  });
  const workedArea = {
    value: sumMeasured(areaValues),
    unavailableCount: areaValues.filter((value) => value === null).length,
    zeroCount: areaValues.filter((value) => value === 0).length,
  };
  const plots = periodPlots.map((plot) => {
    const metadata = inventoryByCode.get(plot.code);
    return { ...plot, area: metadata?.area ?? null, areaRequiresReview: metadata?.areaRequiresReview ?? false };
  });
  const summary: DashboardSummary = {
    plots,
    daily: aggregateDailyTrend(filtered),
    totals: {
      plotCount: plots.length,
      area: plots.every((plot) => plot.area !== null) ? sumMeasured(plots.map((plot) => plot.area)) : null,
      ...calculateKpis(filtered),
    },
    statuses: [...workStatuses, "Belum diketahui" as const, "Perlu tinjau" as const].map((status) => ({
      status, count: plots.filter((plot) => (plot.statusAmbiguous ? "Perlu tinjau" : plot.status ?? "Belum diketahui") === status).length,
    })).filter((item) => item.count > 0),
    missingMeasurements: filtered.filter((row) => (["actualFuelUsage", "workingHours", "fuelRefill"] as const).some((field) => measurement(row, field) === null)).length,
  };
  const eligible = validated.records.filter((row) => row.duplicateOf === null && row.record.plotCode && validDate(row.record.date));
  const visibleInventory = inventory.filter((plot) => (!filters.plotCodes.length || filters.plotCodes.includes(plot.code)) &&
    (!filters.statuses.length || filters.statuses.some((status) => status === plot.status)));
  const normalizationIssues = normalized.issues.filter((issue) => {
    if (issue.code !== "missing_value" || (issue.field !== "plotArea" && issue.field !== "totalFuelConsumption")) return true;
    const plot = inventoryByCode.get(recordsByRow.get(issue.source.row)?.plotCode ?? "");
    return !(issue.field === "plotArea" ? plot?.areaMetadata : plot?.cumulativeFuelMetadata)?.sourceRows.length;
  });
  return {
    summary,
    workedArea,
    inventory,
    visibleInventory,
    filteredRecords: filtered.map((row) => row.record),
    filteredValidatedRecords: filtered,
    validatedRecords: validated.records,
    records: normalized.records,
    issues: [...normalizationIssues, ...validated.issues].sort((a, b) => a.source.row - b.source.row),
    plotCodes: inventory.map((plot) => plot.code),
    periods: [...new Set(eligible.map((row) => row.record.date!.slice(0, 7)))].sort(),
    excludedRows: validated.records.length - eligible.length,
  };
}
