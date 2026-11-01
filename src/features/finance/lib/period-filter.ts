import { filtersForPeriod } from "../../dashboard/lib/overview";
import { validDate } from "../../dashboard/lib/normalize-overview";

export function financePeriodSelection(start: string, end: string) {
  const month = start.slice(0, 7);
  const range = validDate(`${month}-01`) ? filtersForPeriod(month) : null;
  if (range && range.startDate === start && range.endDate === end) return { year: month.slice(0, 4), month: month.slice(5), custom: false };
  const year = start.slice(0, 4);
  if (validDate(`${year}-01-01`) && start === `${year}-01-01` && end === `${year}-12-31`) return { year, month: "", custom: false };
  return { year: "", month: "", custom: Boolean(start || end) };
}

export function financePeriodRange(year: string, month: string) {
  if (!validDate(`${year}-01-01`)) return { start: "", end: "" };
  if (!month) return { start: `${year}-01-01`, end: `${year}-12-31` };
  const period = `${year}-${month}`;
  if (!validDate(`${period}-01`)) return { start: "", end: "" };
  const dates = filtersForPeriod(period);
  return { start: dates.startDate, end: dates.endDate };
}
