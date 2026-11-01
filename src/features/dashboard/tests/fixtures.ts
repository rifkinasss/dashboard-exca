import { overviewColumns, type OverviewField, type RawCell, type RawOverviewRow } from "../types";
import { normalizeOverview } from "../lib/normalize-overview";
import { validateOverview } from "../lib/validate-overview";

export function row(overrides: Partial<Record<OverviewField, RawCell>> = {}): RawOverviewRow {
  const baseline: RawOverviewRow = [7, "SPK-001", "PTK-01", "4,8", 9999, "01/10/2026", 100, 110, 10, 65, 120, 999, 100, 80, "Dalam pengerjaan", "Fixture sintetis"];
  return overviewColumns.map(({ field }, index) => Object.hasOwn(overrides, field) ? overrides[field] : baseline[index]);
}

export const fixture = [
  row(),
  row({ date: "02/10/2026", hmStart: 110, hmEnd: 113, workingHours: 3, fuelRefill: 0, actualFuelUsage: 90, totalFuelConsumption: 99999, workStatus: "Selesai" }),
  row({ no: 3, plotCode: "PTK-02", plotArea: "6,2", hmStart: 200, hmEnd: 207, workingHours: 7, fuelRefill: 50, actualFuelUsage: "", workStatus: "Ditunda" }),
  row({ no: 4, plotCode: "PTK-02", plotArea: "6,2", date: "02/10/2026", hmStart: 207, hmEnd: 209, workingHours: 2, fuelRefill: 0, actualFuelUsage: 0, workStatus: "Ditunda" }),
] satisfies RawOverviewRow[];

export function prepare(rows: readonly RawOverviewRow[]) {
  const normalized = normalizeOverview(rows);
  const validation = validateOverview(normalized.records);
  return { ...validation, issues: [...normalized.issues, ...validation.issues] };
}
