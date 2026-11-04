import "server-only";
import { JWT } from "google-auth-library";
import { createWithdrawalWrite, type WithdrawalValue } from "../../lib/fuel-withdrawal-write";
import { FUEL_PRICE_RANGE, fuelPriceForDate, parseFuelPriceCatalog } from "../../lib/fuel-price";
import { readSourceConfig } from "./config";
import { invalidateFuelWithdrawals } from "./fuel-withdrawal-source";

let saving = false;
export function withdrawalWriterReady() {
  return process.env.ENABLE_FUEL_WITHDRAWAL_WRITES === "true" && Boolean(process.env.GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_WRITER_PRIVATE_KEY);
}

export async function writeFuelWithdrawal(input: WithdrawalValue, actor: string): Promise<{ ok: boolean; message: string; uncertain?: boolean }> {
  if (!withdrawalWriterReady()) return { ok: false, message: "Penyimpanan belum dikonfigurasi." };
  if (saving) return { ok: false, message: "Ada penyimpanan yang sedang berlangsung. Coba lagi setelah selesai." };
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
    const columnCount = sheet?.properties?.gridProperties?.columnCount;
    if (typeof sheetId !== "number" || typeof rowCount !== "number" || typeof columnCount !== "number" || columnCount < 6 || !Array.isArray(sheet?.merges ?? [])) return { ok: false, message: "Struktur worksheet tidak dapat diverifikasi." };
    const sheetRange = (range: string) => `${base}/values/${encodeURIComponent(`'Pengambilan Solar'!${range}`)}`;
    const source = await get(sheetRange("A4:F"), { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }) as { values?: unknown[][] };
    const prices = await get(`${base}/values/${encodeURIComponent(FUEL_PRICE_RANGE)}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }) as { values?: unknown[][] };
    const catalog = parseFuelPriceCatalog(prices.values);
    const approved = fuelPriceForDate(catalog, input.date);
    if (!approved) return { ok: false, message: "Harga aktif untuk tanggal pengambilan belum tersedia atau perlu ditinjau." };
    if (approved.rupiahPerLiter !== input.price) return { ok: false, message: "Harga telah berubah. Muat ulang halaman dan tinjau kembali sebelum menyimpan." };
    const plan = createWithdrawalWrite(source.values ?? [], input, { sheetId, rowCount, merges: sheet?.merges ?? [] });
    if (!plan.ok) return { ok: false, message: plan.reason };
    if (plan.firstRow <= rowCount) {
      const target = await get(sheetRange(`A${plan.firstRow}:F${Math.min(plan.lastRow, rowCount)}`), { majorDimension: "ROWS", valueRenderOption: "FORMULA" }) as { values?: unknown[][] };
      if (target.values?.some((row) => row.some((value) => value !== "" && value !== null && value !== undefined))) return { ok: false, message: "Area tujuan tidak kosong; periksa worksheet sebelum mencoba lagi." };
    }
    submitted = true;
    await auth.request({ url: `${base}:batchUpdate`, method: "POST", data: { requests: plan.requests }, timeout: 15000, retry: false });
    const checked = await get(sheetRange(`A${plan.dataRow}:F${plan.dataRow}`), { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }) as { values?: unknown[][] };
    if (!plan.rowValues.every((value, index) => checked.values?.[0]?.[index] === value)) throw new Error("Readback mismatch");
    invalidateFuelWithdrawals();
    console.info("fuel_withdrawal_saved", { actor, worksheet: "Pengambilan Solar", row: plan.dataRow, at: new Date().toISOString() });
    return { ok: true, message: "Pengambilan solar berhasil disimpan." };
  } catch {
    if (submitted) {
      invalidateFuelWithdrawals();
      return { ok: false, uncertain: true, message: "Hasil penyimpanan belum dapat dipastikan. Periksa Google Sheets sebelum mencoba lagi agar tidak tercatat dua kali." };
    }
    return { ok: false, message: "Data belum disimpan. Periksa akses penulis dan struktur worksheet." };
  } finally { saving = false; }
}
