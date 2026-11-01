import { measurement } from "../../dashboard/lib/calculate-kpis";
import { validDate } from "../../dashboard/lib/normalize-overview";
import type { DashboardFilters, ValidatedOverviewRecord } from "../../dashboard/types";
import type { FinanceIssue, FinanceRecord } from "../types";
import { allocateRevenue } from "./revenue-allocation";

export function buildDailyEstimate(matched: readonly { record: FinanceRecord; pair: { rows: ValidatedOverviewRecord[] } }[], filters: DashboardFilters) {
  const daily = new Map<string, { date: string; gross: number | null; cost: number | null; grossCount: number; costCount: number; activityCount: number }>();
  const issues: FinanceIssue[] = [];
  let grossPairs = 0, costPairs = 0;
  for (const { record, pair } of matched) {
    const hours = pair.rows.map((row) => ({ date: row.record.date, hours: measurement(row, "workingHours") }));
    const gross = record.grossValue === null ? null : allocateRevenue(record.grossValue, hours, "operational_hours");
    const cost = record.fuelCost === null ? null : allocateRevenue(record.fuelCost, hours, "operational_hours");
    if (!gross && !cost) {
      issues.push({ code: "allocation_unavailable", worksheet: record.worksheet, row: record.row, relatedRows: pair.rows.map((row) => row.record.source.row), message: "Estimasi tidak tersedia: nominal tidak lengkap atau tanggal dan HM aktivitas tidak valid, tidak lengkap, atau total HM nol." });
      continue;
    }
    if (gross) grossPairs++;
    if (cost) costPairs++;
    for (const [index, activity] of hours.entries()) {
      const date = activity.date!;
      if ((filters.startDate && (!validDate(filters.startDate) || date < filters.startDate)) || (filters.endDate && (!validDate(filters.endDate) || date > filters.endDate))) continue;
      const item = daily.get(date) ?? { date, gross: null, cost: null, grossCount: 0, costCount: 0, activityCount: 0 };
      item.activityCount++;
      if (gross) { item.gross = (item.gross ?? 0) + gross[index].value; item.grossCount++; }
      if (cost) { item.cost = (item.cost ?? 0) + cost[index].value; item.costCount++; }
      daily.set(date, item);
    }
  }
  return { rows: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), issues, grossPairs, costPairs, totalPairs: matched.length };
}

export function groupMonthlyEstimates(rows: readonly { date: string; gross: number | null; cost: number | null }[]) {
  const months = new Map<string, { date: string; gross: number | null; cost: number | null }>();
  for (const row of rows) {
    const date = row.date.slice(0, 7);
    const month = months.get(date) ?? { date, gross: null, cost: null };
    if (row.gross !== null) month.gross = (month.gross ?? 0) + row.gross;
    if (row.cost !== null) month.cost = (month.cost ?? 0) + row.cost;
    months.set(date, month);
  }
  return [...months.values()].sort((a, b) => a.date.localeCompare(b.date));
}
