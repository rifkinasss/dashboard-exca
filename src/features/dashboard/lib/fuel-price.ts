import { validDate } from "./normalize-overview";

export const FUEL_PRICE_RANGE = "'Pengambilan Solar'!H4:L";

export type FuelPrice = { effectiveDate: string; rupiahPerLiter: number };
export type FuelPriceRecord = FuelPrice & { active: boolean; sourceRow: number; note: string };
export type FuelPriceCatalog = { prices: FuelPrice[]; records: FuelPriceRecord[]; issues: string[] };

function sheetDate(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2958465) return null;
  const date = new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
  return validDate(date) ? date : null;
}

export function isEmptyFuelPriceRow(row: readonly unknown[]) {
  const empty = (value: unknown) => value === "" || value === null || value === undefined;
  return empty(row[1]) && empty(row[2]) && (empty(row[3]) || row[3] === false) && empty(row[4]);
}

export function parseFuelPriceCatalog(master: unknown): FuelPriceCatalog {
  if (!Array.isArray(master) || !Array.isArray(master[0]) || ["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"].some((name, i) => master[0][i] !== name)) return { prices: [], records: [], issues: ["Header tabel harga di Pengambilan Solar tidak sesuai."] };
  const issues: string[] = [];
  const seen = new Set<string>();
  const records: FuelPriceRecord[] = [];
  master.slice(1).forEach((row, index) => {
    if (!Array.isArray(row)) { issues.push(`Harga baris ${index + 5} tidak valid.`); return; }
    if (isEmptyFuelPriceRow(row)) return;
    const date = sheetDate(row[1]);
    if (!date || typeof row[2] !== "number" || !Number.isFinite(row[2]) || row[2] <= 0 || typeof row[3] !== "boolean") { issues.push(`Harga baris ${index + 5} membutuhkan tanggal, harga positif, dan status boolean.`); return; }
    if (seen.has(date)) issues.push(`Tanggal harga ${date} ganda.`);
    seen.add(date);
    if (row[4] !== undefined && row[4] !== null && typeof row[4] !== "string") { issues.push(`Harga baris ${index + 5} memiliki keterangan tidak valid.`); return; }
    records.push({ effectiveDate: date, rupiahPerLiter: row[2], active: row[3], sourceRow: index + 5, note: typeof row[4] === "string" ? row[4] : "" });
  });
  records.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  if (issues.length) return { prices: [], records, issues };
  return { prices: records.filter((record) => record.active).map(({ effectiveDate, rupiahPerLiter }) => ({ effectiveDate, rupiahPerLiter })), records, issues };
}

export function fuelPriceForDate(catalog: FuelPriceCatalog | null, date: string): FuelPrice | null {
  if (!catalog || catalog.issues.length || !validDate(date)) return null;
  return catalog.prices.filter((price) => price.effectiveDate <= date).at(-1) ?? null;
}

export function resolveWithdrawalPricing(record: { date: string; liters: number; price: number | null; cost: number | null; priceInvalid: boolean }, catalog: FuelPriceCatalog | null) {
  if (record.priceInvalid) return { kind: "review" as const, price: null, cost: null };
  if (record.price !== null && record.cost !== null) return { kind: "recorded" as const, price: record.price, cost: record.cost };
  const price = fuelPriceForDate(catalog, record.date)?.rupiahPerLiter;
  if (price === undefined || !Number.isFinite(price * record.liters)) return { kind: "unavailable" as const, price: null, cost: null };
  return { kind: "estimated" as const, price, cost: price * record.liters };
}
