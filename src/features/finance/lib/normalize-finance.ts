import { normalizePlotCode, parseOverviewNumber } from "../../dashboard/lib/normalize-overview";
import type { FinanceCell, FinanceIssue, FinanceMerge, FinanceRecord, RawFinanceRow } from "../types";

const blank = (v: FinanceCell) => v == null || (typeof v === "string" && !v.trim());
const id = (v: FinanceCell) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) ? String(v).trim() || null : null;
const amount = (v: FinanceCell, currency: boolean) => {
  const value = currency && typeof v === "string" ? v.trim().replace(/^Rp\s*/i, "") : v;
  return parseOverviewNumber(value, "id-ID");
};

export function normalizeFinance(rows: readonly RawFinanceRow[], options: { worksheet?: string; spkMerges?: readonly FinanceMerge[]; plotCodeMerges?: readonly FinanceMerge[] } = {}) {
  const worksheet = options.worksheet ?? "Overview Finance";
  const issues: FinanceIssue[] = [];
  const records: FinanceRecord[] = [];
  const summaries: number[] = [];
  function identity(raw: RawFinanceRow, row: number, column: 1 | 2, merges: readonly FinanceMerge[]) {
    const parse = (value: FinanceCell) => column === 1 ? id(value) : normalizePlotCode(value).value;
    const ranges = merges.filter((m) => Number.isSafeInteger(m.startRow) && Number.isSafeInteger(m.endRow) && m.startRow >= 2 && m.endRow >= m.startRow && row >= m.startRow && row <= m.endRow);
    if (!ranges.length) return { value: parse(raw[column]), source: parse(raw[column]) ? row : null };
    const range = ranges[0];
    const anchor = parse(rows[range.startRow - 2]?.[column]);
    if (ranges.length !== 1 || !anchor || rows.slice(range.startRow - 2, range.endRow - 1).some((item) => !blank(item[column]) && parse(item[column]) !== anchor)) {
      issues.push({ code: "ambiguous_merge", worksheet, row, message: `${column === 1 ? "SPK" : "Kode petak"} pada sel gabungan ambigu.` });
      return { value: null, source: null };
    }
    return { value: anchor, source: range.startRow };
  }
  for (const [index, raw] of rows.entries()) {
    const row = index + 2;
    if (raw.every(blank)) continue;
    if (typeof raw[0] === "string" && /^total$/i.test(raw[0].trim()) && blank(raw[1]) && blank(raw[2])) { summaries.push(row); continue; }
    const spk = identity(raw, row, 1, options.spkMerges ?? []);
    const plot = identity(raw, row, 2, options.plotCodeMerges ?? []);
    if (!spk.value) issues.push({ code: "missing_spk", worksheet, row, message: "Nomor SPK tidak tersedia atau ambigu." });
    if (!plot.value) issues.push({ code: "missing_plot", worksheet, row, message: "Kode petak tidak tersedia atau ambigu." });
    const parseNumber = (column: number, name: string, currency = false, allowNegative = false) => {
      const parsed = amount(raw[column], currency);
      if (parsed.state === "invalid" || (parsed.state === "valid" && !allowNegative && parsed.value < 0)) {
        issues.push({ code: "invalid_amount", worksheet, row, message: `${name} tidak valid.` }); return null;
      }
      return parsed.value;
    };
    const area = parseNumber(3, "Luas");
    const pricePerHa = parseNumber(4, "Harga per ha", true);
    const pricePerPlot = parseNumber(5, "Harga per petak", true);
    const fuelPrice = parseNumber(6, "Harga solar", true);
    const fuelRefill = parseNumber(7, "Pengisian solar");
    const recordedFuelCost = parseNumber(8, "Pengeluaran solar", true);
    const grossValue = parseNumber(9, "Pendapatan kotor", true);
    const sourceNetValue = parseNumber(10, "Pendapatan bersih sumber", true, true);
    let fuelCost = recordedFuelCost;
    if (fuelRefill === null || fuelPrice === null || recordedFuelCost === null) {
      fuelCost = null;
      issues.push({ code: "incomplete_fuel_cost", worksheet, row, message: "Biaya solar belum terverifikasi karena harga, volume, atau pengeluaran tidak tersedia." });
    } else if (Math.abs(fuelRefill * fuelPrice - recordedFuelCost) > 0.01) {
      fuelCost = null;
      issues.push({ code: "fuel_cost_conflict", worksheet, row, message: "Pengeluaran solar berbeda dari harga dan volume sumber; biaya perlu ditinjau." });
    }
    records.push({ row, worksheet, spk: spk.value, plot: plot.value, spkSourceRow: spk.source, plotSourceRow: plot.source, area, pricePerHa, pricePerPlot, fuelPrice, fuelRefill, fuelCost, grossValue, sourceNetValue, raw: [...raw] });
  }
  return { records, issues, summaries };
}
