import type { PlotSummary, ValidatedOverviewRecord } from "../types";
import { calculateKpis, measurement } from "./calculate-kpis";
import { deriveWorkStatus } from "./derive-work-status";

export function aggregateByPlot(records: readonly ValidatedOverviewRecord[], sheetOrderConfirmed = false): PlotSummary[] {
  const active = records.filter((row) => row.duplicateOf === null && row.record.plotCode);
  return [...Map.groupBy(active, (row) => row.record.plotCode)].map(([code, rows]) => {
    const values = [...new Set(rows.map((row) => measurement(row, "plotArea")).filter((area) => area !== null))];
    const areaRequiresReview = values.length > 1 || rows.some((row) => row.record.plotArea !== null && row.invalidFields.includes("plotArea"));
    const status = deriveWorkStatus(rows.map((row) => row.record), sheetOrderConfirmed);
    const metrics = calculateKpis(rows);
    return {
      code, area: areaRequiresReview || values.length !== 1 ? null : values[0], areaRequiresReview,
      fuel: metrics.fuel, hours: metrics.hours, efficiency: metrics.efficiency,
      status: status.status, statusAmbiguous: status.ambiguous,
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
}
