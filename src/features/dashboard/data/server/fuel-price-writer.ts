import "server-only";
import { JWT } from "google-auth-library";
import { FUEL_PRICE_RANGE, isEmptyFuelPriceRow } from "../../lib/fuel-price";
import { planFuelPriceActivation, planFuelPriceInsert, type FuelPriceInput, validateFuelPriceInput } from "../../lib/fuel-price-input";
import { readSourceConfig } from "./config";
import { invalidateFuelPriceCatalog } from "./fuel-price-source";

let saving = false;
export function fuelPriceWriterReady() {
  return process.env.ENABLE_FUEL_PRICE_WRITES === "true" && Boolean(process.env.GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_WRITER_PRIVATE_KEY);
}

type Operation = { kind: "insert"; input: FuelPriceInput } | { kind: "activate"; row: number; date: string; expectedPrice: number };

export async function writeFuelPrice(operation: Operation, actor: string): Promise<{ ok: boolean; message: string; uncertain?: boolean }> {
  if (!fuelPriceWriterReady()) return { ok: false, message: "Penyimpanan harga belum dikonfigurasi." };
  if (saving) return { ok: false, message: "Ada penyimpanan harga yang sedang berlangsung." };
  saving = true;
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return { ok: false, message: "Sumber data bukan Google Sheets." };
    const auth = new JWT({ email: process.env.GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_WRITER_PRIVATE_KEY!.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets"], transporterOptions: { timeout: 15000, retry: false } });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const get = async (url: string, params: Record<string, string>) => (await auth.request<unknown>({ url, params, method: "GET", timeout: 15000, retry: false })).data;
    const metadata = await get(base, { fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),merges)" }) as { sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } }; merges?: { startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number }[] }[] };
    const sheet = metadata.sheets?.find((item) => item.properties?.title === "Pengambilan Solar");
    const sheetId = sheet?.properties?.sheetId;
    const rowCount = sheet?.properties?.gridProperties?.rowCount;
    if (typeof sheetId !== "number" || typeof rowCount !== "number" || (sheet?.properties?.gridProperties?.columnCount ?? 0) < 12 || !Array.isArray(sheet?.merges ?? [])) return { ok: false, message: "Struktur tabel harga tidak dapat diverifikasi." };
    const urlFor = (range: string) => `${base}/values/${encodeURIComponent(`'Pengambilan Solar'!${range}`)}`;
    const source = await get(`${base}/values/${encodeURIComponent(FUEL_PRICE_RANGE)}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }) as { values?: unknown[][] };
    const values = source.values ?? [];
    let row: number;
    let expected: (string | number | boolean)[];
    const requests: object[] = [];
    if (operation.kind === "insert") {
      const input = validateFuelPriceInput(operation.input);
      if (!input.ok) return { ok: false, message: input.errors.join(" ") };
      const plan = planFuelPriceInsert(values, input.value);
      if (!plan.ok) return { ok: false, message: plan.reason };
      row = plan.row;
      expected = plan.rowValues;
      const cell = (value: string | number | boolean) => ({ userEnteredValue: typeof value === "number" ? { numberValue: value } : typeof value === "boolean" ? { boolValue: value } : { stringValue: value } });
      if (row > rowCount) requests.push({ appendDimension: { sheetId, dimension: "ROWS", length: row - rowCount } });
      requests.push({ updateCells: { start: { sheetId, rowIndex: row - 1, columnIndex: 7 }, rows: [{ values: expected.map(cell) }], fields: "userEnteredValue" } });
      requests.push({ repeatCell: { range: { sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 8, endColumnIndex: 9 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } });
    } else {
      const plan = planFuelPriceActivation(values, operation.row, operation.date, operation.expectedPrice);
      if (!plan.ok) return { ok: false, message: plan.reason };
      row = plan.row;
      expected = [true];
      requests.push({ updateCells: { start: { sheetId, rowIndex: row - 1, columnIndex: 10 }, rows: [{ values: [{ userEnteredValue: { boolValue: true } }] }], fields: "userEnteredValue" } });
    }
    if ((sheet?.merges ?? []).some((merge) => (merge.startColumnIndex ?? 0) < 12 && (merge.endColumnIndex ?? 12) > 7 && (merge.startRowIndex ?? 0) < row && (merge.endRowIndex ?? Infinity) > row - 1)) return { ok: false, message: "Baris harga memiliki sel gabung dan perlu ditinjau." };
    if (row <= rowCount) {
      const target = await get(urlFor(`H${row}:L${row}`), { majorDimension: "ROWS", valueRenderOption: "FORMULA" }) as { values?: unknown[][] };
      const cells = target.values?.[0] ?? [];
      if (operation.kind === "insert") {
        if ((cells[0] !== undefined && cells[0] !== "" && cells[0] !== expected[0]) || !isEmptyFuelPriceRow(cells)) return { ok: false, message: "Baris tujuan telah berubah atau berisi formula; periksa worksheet." };
      } else {
        const serial = Date.parse(`${operation.date}T00:00:00Z`) / 86400000 + 25569;
        if (cells[1] !== serial || cells[2] !== operation.expectedPrice || cells[3] !== false) return { ok: false, message: "Harga, tanggal, atau status telah berubah atau berupa formula; muat ulang halaman." };
      }
    }
    submitted = true;
    await auth.request({ url: `${base}:batchUpdate`, method: "POST", data: { requests }, timeout: 15000, retry: false });
    const range = operation.kind === "insert" ? `H${row}:L${row}` : `K${row}:K${row}`;
    const readback = await get(urlFor(range), { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }) as { values?: unknown[][] };
    if (!expected.every((value, index) => (readback.values?.[0]?.[index] ?? "") === value)) throw new Error("Readback mismatch");
    invalidateFuelPriceCatalog();
    console.info("fuel_price_saved", { actor, row, action: operation.kind, at: new Date().toISOString() });
    return { ok: true, message: operation.kind === "insert" ? "Harga solar berhasil disimpan." : "Harga solar berhasil diaktifkan." };
  } catch {
    if (submitted) { invalidateFuelPriceCatalog(); return { ok: false, uncertain: true, message: "Hasil belum dapat dipastikan. Periksa tabel harga di Google Sheets sebelum mencoba lagi." }; }
    return { ok: false, message: "Harga belum disimpan. Periksa akses penulis dan struktur worksheet." };
  } finally { saving = false; }
}
