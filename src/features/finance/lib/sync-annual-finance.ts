import type { SheetsSnapshot } from "../../dashboard/data/server/google-sheets";
import { normalizePlotCode } from "../../dashboard/lib/normalize-overview";
import type { PlotSheetSummary } from "../../management/lib/plot-sheet";
import { normalizeFinance } from "./normalize-finance";

export function syncAnnualFinance(snapshot: SheetsSnapshot, plots: readonly PlotSheetSummary[]): SheetsSnapshot {
  const { records } = normalizeFinance(snapshot.rows, snapshot);
  const byCode = new Map<string, PlotSheetSummary | null>();
  for (const plot of plots) {
    const code = normalizePlotCode(plot.code).value;
    if (code) byCode.set(code, byCode.has(code) ? null : plot);
  }
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.plot) counts.set(record.plot, (counts.get(record.plot) ?? 0) + 1);
  }

  const rows = [...snapshot.rows];
  for (const record of records) {
    if (!record.plot || counts.get(record.plot) !== 1 || record.plotSourceRow !== record.row) continue;
    const plot = byCode.get(record.plot);
    if (!plot) continue;
    const area = plot.area !== null && plot.area >= 0 ? plot.area : null;
    const rate = plot.pricePerHa !== null && plot.pricePerHa >= 0 ? plot.pricePerHa : null;
    const volume = plot.totalFuelConsumption !== null && plot.totalFuelConsumption >= 0 ? plot.totalFuelConsumption : null;
    const gross = area !== null && rate !== null ? area * rate : null;
    const expense = volume !== null && record.fuelPrice !== null ? volume * record.fuelPrice : null;
    const net = gross !== null && expense !== null ? gross - expense : null;
    // Merged SPKs belong to the entire source range, so leave their shared identity intact.
    const mergedSpk = snapshot.spkMerges?.some(({ startRow, endRow }) => record.row >= startRow && record.row <= endRow);
    rows[record.row - 2] = [
      record.raw[0], mergedSpk ? record.raw[1] : plot.spk ?? record.spk,
      record.raw[2], area, rate, gross, record.raw[6], volume, expense, gross, net,
    ];
  }
  return { ...snapshot, rows };
}
