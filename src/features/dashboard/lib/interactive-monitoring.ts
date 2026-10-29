import { addDays, addWeeks, endOfISOWeek, format, parseISO, startOfISOWeek } from "date-fns";
import { workStatuses, type DashboardFilters, type DataQualityIssue, type OverviewRecord, type ValidatedOverviewRecord, type WorkStatus } from "../types";
import { validDate } from "./normalize-overview";
import { calculateKpis, measurement, sumMeasured } from "./calculate-kpis";
import { deriveWorkStatus } from "./derive-work-status";

export function readFilters(search: string, defaults: DashboardFilters): DashboardFilters {
  const params = new URLSearchParams(search);
  const date = (key: string, fallback: string) => params.has(key) ? (validDate(params.get(key)) ? params.get(key)! : "") : fallback;
  return {
    startDate: date("start", defaults.startDate), endDate: date("end", defaults.endDate),
    plotCodes: params.has("plot") ? [...new Set(params.getAll("plot").filter(Boolean))] : defaults.plotCodes,
    statuses: params.has("status") ? [...new Set(params.getAll("status").filter((s): s is WorkStatus => workStatuses.includes(s as WorkStatus)))] : defaults.statuses,
  };
}

export function writeFilters(search: string, filters: DashboardFilters): string {
  const params = new URLSearchParams(search);
  for (const key of ["start", "end", "plot", "status"]) params.delete(key);
  if (filters.startDate) params.set("start", filters.startDate);
  if (filters.endDate) params.set("end", filters.endDate);
  filters.plotCodes.forEach((code) => params.append("plot", code));
  filters.statuses.forEach((status) => params.append("status", status));
  return params.toString();
}

export function monitoringTrend(rows: readonly ValidatedOverviewRecord[], interval: "daily" | "weekly") {
  const dated = rows.filter(({ record }) => validDate(record.date));
  if (!dated.length) return [];
  const key = (date: string) => interval === "weekly" ? format(startOfISOWeek(parseISO(date)), "yyyy-MM-dd") : date;
  const groups = Map.groupBy(dated, ({ record }) => key(record.date!));
  const dates = [...groups.keys()].sort();
  const result = [];
  for (let current = parseISO(dates[0]); format(current, "yyyy-MM-dd") <= dates.at(-1)!; current = interval === "weekly" ? addWeeks(current, 1) : addDays(current, 1)) {
    const date = format(current, "yyyy-MM-dd");
    const group = groups.get(date) ?? [];
    result.push({ date, endDate: interval === "weekly" ? format(endOfISOWeek(current), "yyyy-MM-dd") : date,
      fuel: sumMeasured(group.map((row) => measurement(row, "actualFuelUsage"))),
      hours: sumMeasured(group.map((row) => measurement(row, "workingHours"))),
      plots: [...new Set(group.map(({ record }) => record.plotCode))].sort().join(", ") });
  }
  return result;
}

export function plotDetails(code: string, allRows: readonly ValidatedOverviewRecord[], periodRows: readonly ValidatedOverviewRecord[]) {
  const history = allRows.filter(({ record, duplicateOf }) => record.plotCode === code && duplicateOf === null && validDate(record.date));
  const dates = history.map(({ record }) => record.date!).sort();
  const activity = periodRows.filter(({ record }) => record.plotCode === code).sort((a, b) => a.record.date!.localeCompare(b.record.date!) || a.record.source.row - b.record.source.row);
  const metrics = calculateKpis(activity);
  const incomplete = activity.some((row) => measurement(row, "actualFuelUsage") === null || measurement(row, "workingHours") === null || (!row.efficiencyEligible && (measurement(row, "actualFuelUsage") !== 0 || measurement(row, "workingHours") !== 0)));
  return { activity, metrics, firstDate: dates[0] ?? null, lastDate: dates.at(-1) ?? null,
    latest: deriveWorkStatus(history.map(({ record }) => record)),
    comparableEfficiency: !incomplete ? metrics.efficiency : null };
}

export function filterQuality(issues: readonly DataQualityIssue[], records: readonly OverviewRecord[], filters: { severity: string; plot: string; row: string; code: string }) {
  const byRow = new Map(records.map((record) => [record.source.row, record.plotCode]));
  return issues.filter((issue) => (!filters.severity || issue.severity === filters.severity) && (!filters.plot || byRow.get(issue.source.row) === filters.plot) && (!filters.row || String(issue.source.row) === filters.row) && (!filters.code || issue.code === filters.code));
}
