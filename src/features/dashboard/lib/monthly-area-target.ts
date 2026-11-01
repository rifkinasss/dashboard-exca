import { MONTHLY_AREA_TARGET_HA } from "../config/monthly-target";
import { overviewColumns, type DashboardFilters, type DataQualityIssue, type InventoryPlot, type OverviewRecord, type ValidatedOverviewRecord } from "../types";
import { validDate } from "./normalize-overview";
import { filtersForPeriod } from "./overview";

export function calculateMonthlyAreaTarget(rows: readonly ValidatedOverviewRecord[], inventory: readonly InventoryPlot[], records: readonly OverviewRecord[], filters: DashboardFilters) {
  const period = filters.startDate.slice(0, 7);
  if (!validDate(filters.startDate) || !validDate(filters.endDate) || filters.startDate !== `${period}-01` || filtersForPeriod(period).endDate !== filters.endDate) {
    return { month: null, completedAreaHa: null, achievementPercentage: null, remainingAreaHa: null, issues: [] as DataQualityIssue[] };
  }
  const statusIndex = overviewColumns.findIndex((column) => column.field === "workStatus");
  const completions = rows.filter(({ record, duplicateOf }) => {
    const rawStatus = record.raw[statusIndex];
    return duplicateOf === null && record.plotCode && validDate(record.date) && record.date.slice(0, 7) === period && record.workStatus === "Selesai" &&
      typeof rawStatus === "string" && rawStatus.trim().replace(/\s+/g, " ").toLowerCase() === "garap petak selesai";
  });
  const byCode = new Map(inventory.map((plot) => [plot.code, plot]));
  const recordsByRow = new Map(records.map((record) => [record.source.row, record]));
  const issues: DataQualityIssue[] = [];
  let completedAreaHa = 0;
  for (const [code, events] of Map.groupBy(completions, (row) => row.record.plotCode)) {
    const plot = byCode.get(code);
    if (plot?.area !== null && plot?.area !== undefined && plot.area > 0 && !plot.areaRequiresReview) {
      completedAreaHa += plot.area;
      continue;
    }
    const sources = plot?.areaMetadata.sourceRows ?? [];
    const candidates = sources.map((source) => recordsByRow.get(source.row)).filter((record): record is OverviewRecord => record !== undefined);
    const values = new Set(candidates.map((record) => record.plotArea).filter((value): value is number => value !== null));
    const reason = !candidates.length ? "luas tidak tersedia" : candidates.some((record) => record.cellStates.plotArea === "invalid" || (record.plotArea !== null && record.plotArea < 0)) ? "luas tidak valid" : values.size > 1 ? "luas saling bertentangan" : values.has(0) ? "luas bernilai nol" : "luas perlu ditinjau";
    const source = sources[0] ?? events[0].record.source;
    const relatedRows = [...new Set([...sources.map((item) => item.row), ...events.map(({ record }) => record.source.row)])].filter((row) => row !== source.row);
    issues.push({ severity: "warning", code: "completion_area_excluded", field: "plotArea", source, relatedRows, message: `Petak ${code} dikecualikan dari target ${period}: ${reason}.` });
  }
  return {
    month: period,
    completedAreaHa,
    achievementPercentage: completedAreaHa / MONTHLY_AREA_TARGET_HA * 100,
    remainingAreaHa: Math.max(0, MONTHLY_AREA_TARGET_HA - completedAreaHa),
    issues,
  };
}
