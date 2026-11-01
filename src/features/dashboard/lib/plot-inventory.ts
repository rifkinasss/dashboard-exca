import type { DashboardFilters, InventoryPlot, PlotMetadata, PlotSummary, ValidatedOverviewRecord } from "../types";
import { deriveWorkStatus } from "./derive-work-status";
import { validDate } from "./normalize-overview";

function metadata(rows: ValidatedOverviewRecord[], field: "plotArea" | "totalFuelConsumption"): PlotMetadata {
  const candidates = rows.filter(({ record }) => record.cellStates[field] !== "missing");
  const values = [...new Set(candidates.map(({ record }) => record[field]).filter((value): value is number => value !== null))];
  const requiresReview = values.length > 1 || candidates.some(({ record, invalidFields }) =>
    record.cellStates[field] === "invalid" || invalidFields.includes(field));
  return {
    value: requiresReview || values.length !== 1 ? null : values[0],
    sourceRows: candidates.map(({ record }) => record.source),
    requiresReview,
  };
}

export function buildPlotInventory(records: readonly ValidatedOverviewRecord[], periodPlots: readonly PlotSummary[], datedRows: readonly ValidatedOverviewRecord[], filters: DashboardFilters, sheetOrderConfirmed = false): InventoryPlot[] {
  const inventoryRows = records.filter((row) => row.record.plotCode);
  const activityCodes = new Set(datedRows.map((row) => row.record.plotCode));
  const periodByCode = new Map(periodPlots.map((plot) => [plot.code, plot]));
  const validRange = (!filters.startDate || validDate(filters.startDate)) && (!filters.endDate || validDate(filters.endDate)) &&
    (!filters.startDate || !filters.endDate || filters.startDate <= filters.endDate);
  return [...Map.groupBy(inventoryRows, (row) => row.record.plotCode)].map(([code, rows]) => {
    const areaMetadata = metadata(rows, "plotArea");
    const cumulativeFuelMetadata = metadata(rows, "totalFuelConsumption");
    const history = rows.filter((row) => row.duplicateOf === null).map((row) => row.record).filter((row) => validRange && validDate(row.date) && (!filters.endDate || row.date <= filters.endDate) && (!filters.selectedSpkNumbers.length || (row.spkNumber !== null && filters.selectedSpkNumbers.includes(row.spkNumber))));
    const status = deriveWorkStatus(history, sheetOrderConfirmed);
    const period = periodByCode.get(code);
    return {
      code, area: areaMetadata.value, areaRequiresReview: areaMetadata.requiresReview,
      fuel: period?.fuel ?? null, hours: period?.hours ?? null, efficiency: period?.efficiency ?? null,
      status: status.status, statusAmbiguous: status.ambiguous,
      areaMetadata, cumulativeFuelMetadata, hasActivity: activityCodes.has(code), includedActivity: Boolean(period),
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
}
