import nextEnv from "@next/env";
import { JWT } from "google-auth-library";

nextEnv.loadEnvConfig(process.cwd());
const env = process.env;
const withdrawal = env.FUEL_WITHDRAWAL_SHEET_NAME?.trim();
const price = env.FUEL_PRICE_SHEET_NAME?.trim();
const expected = "Pengambilan Solar - testing";
if (env.FUEL_TESTING_ONLY !== "true" || withdrawal !== expected || price !== expected || env.PLOT_PRICE_SHEET_NAME?.trim() !== "Master Harga Petak - testing") {
  console.error("Konfigurasi solar bukan target testing yang diharapkan.");
  process.exit(1);
}
if (!env.GOOGLE_SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
  console.error("Konfigurasi Google Sheets belum lengkap.");
  process.exit(1);
}

try {
  const auth = new JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.GOOGLE_SPREADSHEET_ID)}`;
  const read = async (range) => (await auth.request({ url: `${base}/values/${encodeURIComponent(range)}`, params: { valueRenderOption: "FORMULA" } })).data.values ?? [];
  const [activity, purchases, prices, plotPrices] = await Promise.all([
    read("'Okt 2026 - testing'!A92:L104"),
    read("'Pengambilan Solar - testing'!A4:F"),
    read("'Pengambilan Solar - testing'!H4:L"),
    read("'Master Harga Petak - testing'!A5:E"),
  ]);
  const matches = (actual, expectedHeaders) => expectedHeaders.every((item, index) => actual?.[index] === item);
  const activityHeader = ["No", "Tanggal", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)", "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Sisa/Stok Tangki (L)", "Status Pekerjaan", "Keterangan"];
  const purchaseHeader = ["No", "Tanggal Ambil", "Solar", "No Petak", "Harga Solar", "Biaya Solar"];
  const priceHeader = ["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"];
  const headersOk = matches(activity[6], activityHeader) && matches(purchases[0], purchaseHeader) && matches(prices[0], priceHeader);
  console.log(`Header worksheet aktivitas, pembelian, dan harga: ${headersOk ? "sesuai" : "tidak sesuai"}`);
  const plotPriceHeaderOk = matches(plotPrices[0], ["No", "No. SPK", "Kode Petak", "Harga Per Hektar", "Keterangan"]);
  console.log(`Header Master Harga Petak - testing: ${plotPriceHeaderOk ? "sesuai" : "tidak sesuai"}`);
  console.log("Sumber CRUD petak dan aktivitas yang direncanakan: Okt 2026 - testing; belum terhubung ke website.");
  console.log("Pembelian Solar: tambah sudah tersedia; ubah dan arsip belum tersedia.");
  console.log(`Penulisan pembelian diaktifkan: ${env.ENABLE_FUEL_WITHDRAWAL_WRITES === "true" ? "ya" : "tidak"}`);
  console.log("Form aktivitas: belum menyimpan ke worksheet testing.");
  const formula = String(activity[4]?.[2] ?? "");
  if (formula.toUpperCase().replace(/\s/g, "") === "=SUM(I99:I100)") {
    console.log("Perlu tinjauan: rumus C96 hanya mencakup I99:I100, sementara aktivitas berlanjut hingga baris 104.");
  } else {
    console.log("Rumus C96 berubah; tinjau cakupannya sebelum mengaktifkan penulisan aktivitas.");
  }
  console.log("Pemeriksaan hanya membaca data; izin tulis dan penyimpanan melalui website belum diuji.");
  if (!headersOk || !plotPriceHeaderOk) process.exitCode = 1;
} catch {
  console.error("Worksheet testing tidak dapat dibaca. Periksa koneksi, kredensial server, dan nama worksheet.");
  process.exitCode = 1;
}
