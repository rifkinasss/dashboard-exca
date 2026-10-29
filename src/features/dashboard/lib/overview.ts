import type { DashboardFilters, ValidatedOverviewRecord } from "../types";
import { deriveWorkStatus } from "./derive-work-status";
import { validDate } from "./normalize-overview";
import { endOfMonth, format, parseISO } from "date-fns";

export const defaultFilters: DashboardFilters = { startDate: "2026-10-01", endDate: "2026-10-31", plotCodes: [], statuses: [] };

export function filtersForPeriod(period: string): DashboardFilters {
  if (!validDate(`${period}-01`)) throw new RangeError("Periode tidak valid.");
  return { startDate: `${period}-01`, endDate: format(endOfMonth(parseISO(`${period}-01`)), "yyyy-MM-dd"), plotCodes: [], statuses: [] };
}

export function filterOverview(records: readonly ValidatedOverviewRecord[], filters: DashboardFilters, sheetOrderConfirmed = false) {
  if ((filters.startDate && !validDate(filters.startDate)) || (filters.endDate && !validDate(filters.endDate))) return [];
  const dated = records.filter(({ record, duplicateOf }) => duplicateOf === null && record.plotCode && validDate(record.date) &&
    (!filters.startDate || record.date >= filters.startDate) && (!filters.endDate || record.date <= filters.endDate) &&
    (!filters.plotCodes.length || filters.plotCodes.includes(record.plotCode)));
  if (!filters.statuses.length) return dated;
  const statusByPlot = new Map([...Map.groupBy(dated, (row) => row.record.plotCode)].map(([code, rows]) =>
    [code, deriveWorkStatus(rows.map((row) => row.record), sheetOrderConfirmed).status]));
  return dated.filter((row) => filters.statuses.some((status) => status === statusByPlot.get(row.record.plotCode)));
}
