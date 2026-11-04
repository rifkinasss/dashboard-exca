import { parseOverviewNumber } from "../../dashboard/lib/normalize-overview";

export function monitorConsumption(start: string, end: string) {
  const first = start.trim() ? parseOverviewNumber(start, "id-ID") : null;
  const last = end.trim() ? parseOverviewNumber(end, "id-ID") : null;
  if ((first && (first.state !== "valid" || first.value < 0)) || (last && (last.state !== "valid" || last.value < 0))) return { value: null, error: "Angka monitor harus berupa angka nol atau lebih." };
  if (!first || !last || first.state !== "valid" || last.state !== "valid") return { value: null, error: null };
  if (last.value < first.value) return { value: null, error: "Angka monitor akhir lebih kecil dari awal. Periksa catatan operator." };
  return { value: last.value - first.value, error: null };
}
