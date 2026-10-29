import type { OverviewRecord } from "../types";
import { validDate } from "./normalize-overview";

export function deriveWorkStatus(records: readonly OverviewRecord[], sheetOrderConfirmed = false) {
  const known = records.filter((row) => validDate(row.date) && row.workStatus !== null);
  const latestDate = known.reduce<string | null>((date, row) => date === null || row.date! > date ? row.date : date, null);
  const latest = known.filter((row) => row.date === latestDate).sort((a, b) => b.source.row - a.source.row);
  const ambiguous = new Set(latest.map((row) => row.workStatus)).size > 1 && !sheetOrderConfirmed;
  return { status: ambiguous ? null : latest[0]?.workStatus ?? null, ambiguous };
}
