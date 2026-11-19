"use server";
import { isAdministrator } from "@/features/auth/server/permissions";

import { JWT } from "google-auth-library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { activeViewerRow, isAllowedGoogleAccount } from "@/features/auth/allowlist";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { readViewers } from "../data/viewer-access";

export async function revokeViewer(value: string) {
  const session = await auth();
  if (!await isAdministrator(session?.user?.email)) return { ok: false, message: "Hanya administrator yang dapat mencabut akses." };
  if (process.env.ENABLE_SETTINGS_WRITES !== "true") return { ok: false, message: "Penyimpanan pengaturan belum dikonfigurasi." };
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email === session?.user?.email?.trim().toLowerCase() || isAllowedGoogleAccount(email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS)) return { ok: false, message: "Akun administrator tidak dapat diubah di sini." };
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") throw new Error("Source unavailable");
    const client = new JWT({ email: config.email, key: config.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const url = `${base}/values/${encodeURIComponent("'Hak Akses'!A:B")}`;
    const response = await client.request<{ values?: unknown[][] }>({ url, params: { valueRenderOption: "FORMULA" }, timeout: 15000, retry: false });
    const rows = response.data.values ?? [];
    if (rows[0]?.[0] !== "Email" || rows[0]?.[1] !== "Peran") throw new Error("Invalid access schema");
    const row = activeViewerRow(rows, email);
    if (row === null) return { ok: false, message: "Akses tidak ditemukan atau memiliki data ganda. Periksa daftar terlebih dahulu." };
    submitted = true;
    await client.request({ url: `${base}/values/${encodeURIComponent(`'Hak Akses'!B${row}`)}`, method: "PUT", params: { valueInputOption: "RAW" }, data: { values: [["revoked"]] }, timeout: 15000, retry: false });
    if ((await readViewers()).includes(email)) throw new Error("Readback mismatch");
    revalidatePath("/pengaturan");
    return { ok: true, message: "Akses berhasil dicabut." };
  } catch { return { ok: false, message: submitted ? "Hasil pencabutan belum pasti. Periksa daftar sebelum mencoba lagi." : "Daftar akses tidak dapat dibaca. Periksa koneksi dan struktur worksheet." }; }
}
