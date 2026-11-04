import { parseOverviewNumber, validDate } from "./normalize-overview";
import { isEmptyFuelPriceRow, parseFuelPriceCatalog } from "./fuel-price";

export type FuelPriceInput = { date: string; price: string; active: boolean; note: string };

export function formatFuelPriceInput(value: string, caret: number) {
  const normalize = (text: string) => {
    const cleaned = text.replace(/[^0-9,]/g, "");
    const comma = cleaned.indexOf(",");
    return comma < 0 ? cleaned : cleaned.slice(0, comma + 1) + cleaned.slice(comma + 1).replace(/,/g, "");
  };
  const raw = normalize(value);
  const comma = raw.indexOf(",");
  const integer = comma < 0 ? raw : raw.slice(0, comma);
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (comma < 0 ? "" : raw.slice(comma));
  const beforeCaret = normalize(value.slice(0, caret)).length;
  let position = 0;
  let count = 0;
  while (position < formatted.length && count < beforeCaret) {
    if (formatted[position] !== ".") count++;
    position++;
  }
  return { value: formatted, caret: position };
}

export function validateFuelPriceInput(input: FuelPriceInput) {
  const date = input.date.trim();
  const serial = Date.parse(`${date}T00:00:00Z`) / 86400000 + 25569;
  const price = parseOverviewNumber(input.price, "id-ID");
  const note = input.note.trim();
  const errors: string[] = [];
  if (!validDate(date) || !Number.isInteger(serial) || serial < 1 || serial > 2958465) errors.push("Tanggal berlaku tidak valid.");
  if (price.state !== "valid" || price.value <= 0) errors.push("Harga per liter harus lebih dari nol.");
  if (typeof input.active !== "boolean") errors.push("Status harga tidak valid.");
  if (note.length > 300) errors.push("Keterangan maksimal 300 karakter.");
  if (errors.length || price.state !== "valid") return { ok: false as const, errors };
  return { ok: true as const, value: { date, serial, price: price.value, active: input.active, note } };
}

export function planFuelPriceInsert(values: unknown[][], input: Extract<ReturnType<typeof validateFuelPriceInput>, { ok: true }>["value"]) {
  const catalog = parseFuelPriceCatalog(values);
  if (catalog.issues.length) return { ok: false as const, reason: "Tabel harga memiliki kesalahan; periksa sumber sebelum menambah harga." };
  if (catalog.records.some((row) => row.effectiveDate === input.date)) return { ok: false as const, reason: "Tanggal berlaku sudah ada. Aktifkan baris yang tersedia atau pilih tanggal lain." };
  const data = values.slice(1);
  const lastUsed = data.findLastIndex((row) => !isEmptyFuelPriceRow(row));
  const index = lastUsed + 1;
  const next = data[index] ?? [];
  if (!Array.isArray(next) || !isEmptyFuelPriceRow(next)) return { ok: false as const, reason: "Baris tujuan tidak kosong." };
  const existingNumbers = data.map((row) => row[0]).filter((value) => value !== "" && value !== null && value !== undefined);
  if (existingNumbers.some((value) => typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) || new Set(existingNumbers).size !== existingNumbers.length) return { ok: false as const, reason: "Nomor pada tabel harga tidak valid atau duplikat." };
  const number = next[0] === "" || next[0] == null ? Math.max(0, ...existingNumbers as number[]) + 1 : next[0];
  return { ok: true as const, row: index + 5, number, rowValues: [number, input.serial, input.price, input.active, input.note] as (string | number | boolean)[] };
}


export function planFuelPriceActivation(values: unknown[][], row: number, date: string, expectedPrice: number) {
  const catalog = parseFuelPriceCatalog(values);
  if (catalog.issues.length) return { ok: false as const, reason: "Tabel harga memiliki kesalahan; periksa sumber terlebih dahulu." };
  const record = catalog.records.find((entry) => entry.sourceRow === row);
  if (!record || record.effectiveDate !== date || record.rupiahPerLiter !== expectedPrice) return { ok: false as const, reason: "Data harga sudah berubah. Muat ulang halaman." };
  if (record.active) return { ok: false as const, reason: "Harga ini sudah aktif." };
  return { ok: true as const, row };
}
