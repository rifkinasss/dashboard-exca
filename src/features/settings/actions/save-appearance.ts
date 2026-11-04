"use server";

import { JWT } from "google-auth-library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAllowedGoogleAccount } from "@/features/auth/allowlist";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { parseAppearance, validateAppearance } from "../lib/appearance";

export async function saveAppearance(input: unknown) {
  if (process.env.ENABLE_SETTINGS_WRITES !== "true" || !process.env.GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_WRITER_PRIVATE_KEY) return { ok: false, message: "Penyimpanan pengaturan belum dikonfigurasi." };
  const session = await auth();
  if (!isAllowedGoogleAccount(session?.user?.email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS)) return { ok: false, message: "Masuk dengan akun Google yang diizinkan." };
  if (!input || typeof input !== "object" || !("name" in input) || !("theme" in input)) return { ok: false, message: "Pengaturan tidak valid." };
  const value = validateAppearance(input.name, input.theme);
  if (!value) return { ok: false, message: "Masukkan nama aplikasi dan pilih warna yang valid." };
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return { ok: false, message: "Sumber Google Sheets belum dikonfigurasi." };
    const client = new JWT({ email: process.env.GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_WRITER_PRIVATE_KEY.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets"], transporterOptions: { timeout: 15000, retry: false } });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const meta = await client.request<{ sheets?: { properties?: { title?: string }; merges?: { startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number }[] }[] }>({ url: base, params: { fields: "sheets(properties(title),merges)" }, timeout: 15000, retry: false });
    const sheet = meta.data.sheets?.find((entry) => entry.properties?.title === "Pengaturan");
    if (!sheet || sheet.merges?.some((m) => (m.startRowIndex ?? 0) < 3 && (m.endRowIndex ?? Infinity) > 0 && (m.startColumnIndex ?? 0) < 2 && (m.endColumnIndex ?? Infinity) > 0)) return { ok: false, message: "Struktur worksheet Pengaturan tidak sesuai." };
    const url = `${base}/values/${encodeURIComponent("'Pengaturan'!A1:B3")}`;
    const existing = await client.request<{ values?: unknown[][] }>({ url, params: { valueRenderOption: "FORMULA" }, timeout: 15000, retry: false });
    if (!parseAppearance(existing.data.values)) return { ok: false, message: "Isi worksheet Pengaturan tidak sesuai; perubahan dibatalkan." };
    submitted = true;
    await client.request({ url: `${base}/values/${encodeURIComponent("'Pengaturan'!B2:B3")}`, method: "PUT", params: { valueInputOption: "RAW" }, data: { majorDimension: "ROWS", values: [[value.name], [value.theme]] }, timeout: 15000, retry: false });
    const verify = await client.request<{ values?: unknown[][] }>({ url, params: { valueRenderOption: "FORMULA" }, timeout: 15000, retry: false });
    const actual = parseAppearance(verify.data.values);
    if (!actual || actual.name !== value.name || actual.theme !== value.theme) throw new Error("readback mismatch");
    revalidatePath("/", "layout");
    return { ok: true, message: "Pengaturan berhasil disimpan." };
  } catch { return { ok: false, message: submitted ? "Hasil penyimpanan belum dapat dipastikan. Periksa kembali sebelum mencoba." : "Pengaturan belum disimpan. Periksa koneksi dan akses penulis." }; }
}
