import type { DailyFuelTrend, ValidatedOverviewRecord } from "../types";
import { measurement, sumMeasured } from "./calculate-kpis";
import { validDate } from "./normalize-overview";

export function aggregateDailyTrend(records: readonly ValidatedOverviewRecord[]): DailyFuelTrend[] {
  const active = records.filter((row) => row.duplicateOf === null && validDate(row.record.date));
  return [...Map.groupBy(active, (row) => row.record.date!)].map(([date, rows]) => ({
    date,
    fuel: sumMeasured(rows.map((row) => measurement(row, "actualFuelUsage"))),
    byPlot: Object.fromEntries([...Map.groupBy(rows, (row) => row.record.plotCode)].map(([code, plotRows]) =>
      [code, sumMeasured(plotRows.map((row) => measurement(row, "actualFuelUsage")))])),
  })).sort((a, b) => a.date.localeCompare(b.date));
}
