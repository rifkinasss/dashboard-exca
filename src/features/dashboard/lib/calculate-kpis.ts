import type { NumericField, ValidatedOverviewRecord } from "../types";

export function sumMeasured(values: readonly (number | null)[]): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    total += value;
    count++;
  }
  return count > 0 && Number.isFinite(total) ? total : null;
}

export function measurement(row: ValidatedOverviewRecord, field: NumericField): number | null {
  return row.invalidFields.includes(field) ? null : row.record[field];
}

export function calculateKpis(records: readonly ValidatedOverviewRecord[]) {
  const active = records.filter((row) => row.duplicateOf === null);
  const paired = active.filter((row) => row.efficiencyEligible);
  const pairedFuel = sumMeasured(paired.map((row) => measurement(row, "actualFuelUsage")));
  const pairedHours = sumMeasured(paired.map((row) => measurement(row, "workingHours")));
  const rate = pairedFuel !== null && pairedHours !== null && pairedHours > 0 ? pairedFuel / pairedHours : null;
  return {
    refill: sumMeasured(active.map((row) => measurement(row, "fuelRefill"))),
    fuel: sumMeasured(active.map((row) => measurement(row, "actualFuelUsage"))),
    hours: sumMeasured(active.map((row) => measurement(row, "workingHours"))),
    efficiency: rate !== null && Number.isFinite(rate) ? rate : null,
  };
}
