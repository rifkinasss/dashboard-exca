import { endOfMonth, format, parseISO } from "date-fns";
import type { DashboardFilters } from "../types";
import { filtersForPeriod } from "./overview";

export function getPeriodValue(filters: DashboardFilters, periods: readonly string[]) {
  if (!filters.startDate && !filters.endDate) return "all";
  for (const period of periods) {
    const startDate = `${period}-01`;
    const endDate = format(endOfMonth(parseISO(startDate)), "yyyy-MM-dd");
    if (filters.startDate === startDate && filters.endDate === endDate) return period;
  }
  return "custom";
}

export function periodRange(period: string) {
  if (period === "all") return { startDate: "", endDate: "" };
  if (period === "custom") return null;
  const { startDate, endDate } = filtersForPeriod(period);
  return { startDate, endDate };
}

export function countActiveFilters(filters: DashboardFilters) {
  return Number(Boolean(filters.startDate || filters.endDate)) + filters.selectedSpkNumbers.length + filters.plotCodes.length + filters.statuses.length;
}
