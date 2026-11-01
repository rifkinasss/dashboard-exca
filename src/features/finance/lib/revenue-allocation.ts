import { validDate } from "../../dashboard/lib/normalize-overview";

/** Analytic allocation only; never selected by the dashboard without an approved policy. */
export function allocateRevenue(amount: number, rows: readonly { date: string | null; hours: number | null }[], policy: "disabled" | "operational_hours" = "disabled") {
  if (policy === "disabled" || !Number.isFinite(amount) || amount < 0 || rows.some((row) => !validDate(row.date) || row.hours === null || !Number.isFinite(row.hours) || row.hours < 0)) return null;
  const total = rows.reduce((sum, row) => sum + row.hours!, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  let assigned = 0;
  const lastPositive = rows.findLastIndex((row) => row.hours! > 0);
  return rows.map((row, index) => {
    const value = index === lastPositive ? amount - assigned : amount * (row.hours! / total);
    assigned += value;
    return { date: row.date!, value };
  });
}
