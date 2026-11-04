import type { DashboardFilters } from "../types";

export interface FuelWithdrawal { date: string; liters: number; plotCode: string; sourceRow: number; price: number | null; cost: number | null; priceInvalid: boolean }
export interface FuelWithdrawalData { records: FuelWithdrawal[]; invalidRows: number[] }

export function fuelWithdrawalDifference(taken: number | null, refill: number | null): number | null {
  if (taken === null || refill === null || !Number.isFinite(taken - refill)) return null;
  return taken - refill;
}

export function selectPlotPurchases(data: FuelWithdrawalData | null, plotCode: string) {
  const code = plotCode.trim().toUpperCase();
  return (data?.records ?? []).filter((record) => record.plotCode === code).sort((a, b) => b.date.localeCompare(a.date) || b.sourceRow - a.sourceRow);
}

export function selectPlotPurchasesOnDate(data: FuelWithdrawalData | null, plotCode: string, date: string) {
  return date && plotCode.trim() ? selectPlotPurchases(data, plotCode).filter((record) => record.date === date) : [];
}

export function summarizePlotPurchases(data: FuelWithdrawalData | null, plotCode: string) {
  if (!data) return { liters: null, count: 0, invalidRows: 0, available: false };
  const records = selectPlotPurchases(data, plotCode);
  const liters = records.reduce((sum, record) => sum + record.liters, 0);
  return { liters: records.length > 0 && Number.isFinite(liters) ? liters : null, count: records.length, invalidRows: data.invalidRows.length, available: true };
}

export function parseFuelWithdrawals(values: unknown): FuelWithdrawalData {
  if (!Array.isArray(values) || !Array.isArray(values[0]) || ["No", "Tanggal Ambil", "Solar", "No Petak"].some((header, index) => values[0][index] !== header)) throw new Error("Header Pengambilan Solar tidak sesuai");
  const records: FuelWithdrawal[] = [];
  const invalidRows: number[] = [];
  values.slice(1).forEach((raw, index) => {
    const sourceRow = index + 5;
    if (!Array.isArray(raw)) { invalidRows.push(sourceRow); return; }
    if (raw.every((cell) => cell == null || cell === "")) return;
    if (raw[0] === "No" && raw[1] === "Tanggal Ambil" && raw[2] === "Solar" && raw[3] === "No Petak") return;
    const [, serial, liters, plot] = raw;
    if (typeof serial !== "number" || !Number.isInteger(serial) || serial < 1 || serial > 2958465 || typeof liters !== "number" || !Number.isFinite(liters) || liters < 0 || typeof plot !== "string" || !plot.trim()) { invalidRows.push(sourceRow); return; }
    const date = new Date((serial - 25569) * 86400000).toISOString().slice(0, 10);
    const missing = (value: unknown) => value === null || value === undefined || value === "";
    const price = typeof raw[4] === "number" && Number.isFinite(raw[4]) && raw[4] > 0 ? raw[4] : null;
    const cost = typeof raw[5] === "number" && Number.isFinite(raw[5]) && raw[5] >= 0 ? raw[5] : null;
    const priceInvalid = !(missing(raw[4]) && missing(raw[5])) && (price === null || cost === null || Math.abs(liters * price - cost) > 0.01);
    records.push({ date, liters, plotCode: plot.trim().toUpperCase(), sourceRow, price, cost, priceInvalid });
  });
  return { records, invalidRows };
}

export function summarizeFuelWithdrawals(data: FuelWithdrawalData | null, filters: DashboardFilters, knownPlots: readonly string[]) {
  if (!data) return { value: null, note: "Data pengambilan belum tersedia." };
  if (filters.selectedSpkNumbers.length || filters.statuses.length) return { value: null, note: "Tidak tersedia untuk filter SPK atau status." };
  const rows = data.records.filter((record) => (!filters.startDate || record.date >= filters.startDate) && (!filters.endDate || record.date <= filters.endDate) && (!filters.plotCodes.length || filters.plotCodes.includes(record.plotCode)));
  const unknown = data.records.filter((record) => (!filters.startDate || record.date >= filters.startDate) && (!filters.endDate || record.date <= filters.endDate) && !knownPlots.includes(record.plotCode)).length;
  const value = rows.reduce((sum, record) => sum + record.liters, 0);
  const warnings = [data.invalidRows.length ? `${data.invalidRows.length} baris perlu ditinjau` : "", unknown ? `${unknown} baris berkode petak tidak cocok di sumber` : ""].filter(Boolean);
  return { value: Number.isFinite(value) ? value : null, note: warnings.length ? warnings.join(" · ") : "Pengambilan dalam periode" };
}
