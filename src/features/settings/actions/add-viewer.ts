"use server";
import { isAdministrator } from "@/features/auth/server/permissions";
import { JWT } from "google-auth-library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAllowedGoogleAccount } from "@/features/auth/allowlist";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { readAccessUsers, readViewers } from "../data/viewer-access";

export async function addViewer(value: string, role: "viewer" | "operator" | "admin" = "viewer") {
  const session = await auth();
  if (!await isAdministrator(session?.user?.email)) return { ok: false, message: "Hanya administrator yang dapat menambahkan pengguna." };
  if (process.env.ENABLE_SETTINGS_WRITES !== "true") return { ok: false, message: "Penyimpanan pengaturan belum dikonfigurasi." };
  if (role !== "viewer" && role !== "operator" && role !== "admin") return { ok: false, message: "Peran tidak valid." };
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email) || email.length > 254) return { ok: false, message: "Masukkan alamat email yang valid." };
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") throw new Error("Source unavailable");
    if (isAllowedGoogleAccount(email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS) || (await readViewers()).includes(email)) return { ok: false, message: "Akun sudah memiliki akses." };
    const client = new JWT({ email: config.email, key: config.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const meta = await client.request<{ sheets?: { properties?: { title?: string } }[] }>({ url: base, params: { fields: "sheets(properties(title))" }, timeout: 15000, retry: false });
    if (!meta.data.sheets?.some((sheet) => sheet.properties?.title === "Hak Akses")) {
      submitted = true;
      await client.request({ url: `${base}:batchUpdate`, method: "POST", data: { requests: [{ addSheet: { properties: { title: "Hak Akses" } } }] }, timeout: 15000, retry: false });
      await client.request({ url: `${base}/values/${encodeURIComponent("'Hak Akses'!A1:B1")}`, method: "PUT", params: { valueInputOption: "RAW" }, data: { values: [["Email", "Peran"]] }, timeout: 15000, retry: false });
    }
    submitted = true;
    await client.request({ url: `${base}/values/${encodeURIComponent("'Hak Akses'!A:B")}:append`, method: "POST", params: { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" }, data: { values: [[email, role]] }, timeout: 15000, retry: false });
    if (!(await readAccessUsers()).some((user) => user.email === email && user.role === role)) throw new Error("Readback mismatch");
    revalidatePath("/pengaturan");
    return { ok: true, message: "Akses berhasil ditambahkan." };
  } catch { return { ok: false, message: submitted ? "Hasil penyimpanan belum pasti. Periksa daftar sebelum mencoba lagi." : "Daftar akses tidak dapat dibaca. Periksa koneksi dan struktur worksheet." }; }
}
