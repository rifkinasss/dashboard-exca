import "server-only";
import type { SyncErrorCategory, SyncErrorInfo } from "../source-types";

const messages: Record<SyncErrorCategory, [string, string]> = {
  configuration: ["Konfigurasi sumber data belum valid.", "Periksa variabel server di .env.local, lalu restart aplikasi."],
  authentication: ["Autentikasi Google ditolak.", "Periksa pasangan email/private key service account dan status key, lalu restart aplikasi."],
  spreadsheet_not_found: ["Spreadsheet tidak ditemukan atau tidak dapat diakses.", "Periksa ID spreadsheet dan bagikan spreadsheet kepada service account sebagai Viewer."],
  permission_denied: ["Service account tidak memiliki izin membaca spreadsheet.", "Periksa akses Viewer pada spreadsheet dan kebijakan Google Cloud/Workspace."],
  api_disabled: ["Google Sheets API belum aktif untuk project service account.", "Aktifkan Google Sheets API pada project yang sesuai."],
  worksheet_missing: ["Worksheet yang dikonfigurasi tidak ditemukan.", "Periksa GOOGLE_SHEET_NAME; tidak ada worksheet pengganti yang dipilih otomatis."],
  headers_mismatch: ["Header A–P tidak sesuai kontrak worksheet.", "Bandingkan header dan posisi kolom dengan kontrak; kolom tidak diurutkan ulang otomatis."],
  empty_worksheet: ["Worksheet belum berisi data aktivitas.", "Periksa worksheet dan header; tidak ada data demo yang digunakan sebagai pengganti."],
  rate_limit: ["Google membatasi permintaan sementara.", "Tunggu interval cache berikutnya dan periksa kuota Sheets API jika berulang."],
  network: ["Koneksi ke Google gagal atau melewati batas waktu.", "Periksa DNS, koneksi jaringan, dan akses HTTPS ke endpoint Google."],
  source_format: ["Format sumber belum cocok dengan parser Indonesia Phase 2.", "Periksa locale spreadsheet dan format angka/tanggal sebelum menambahkan mapping yang teruji."],
  malformed_response: ["Struktur respons worksheet tidak valid.", "Periksa bentuk baris A–P; hanya sel primitif yang diterima."],
  upstream: ["Google Sheets belum dapat dibaca karena gangguan layanan.", "Coba lagi setelah interval cache; periksa status layanan bila berulang."],
};
export class SheetsSyncError extends Error {
  readonly info: SyncErrorInfo;
  constructor(category: SyncErrorCategory, extra: Pick<SyncErrorInfo, "reason" | "columns"> = {}) {
    const [message, nextAction] = messages[category];
    super(message);
    this.name = "SheetsSyncError";
    this.info = { category, message, nextAction, ...extra };
  }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}
export function safeSyncError(error: unknown): SyncErrorInfo {
  if (error instanceof SheetsSyncError) return error.info;
  const root = object(error);
  const response = object(root.response);
  const data = object(response.data);
  const api = object(data.error);
  const status = response.status;
  const reasons = [...(Array.isArray(api.details) ? api.details : []), ...(Array.isArray(api.errors) ? api.errors : [])].map((item) => object(item).reason);
  let category: SyncErrorCategory = "upstream";
  let reason: string | undefined;
  if (["invalid_grant", "invalid_client", "unauthorized_client"].includes(String(data.error)) || status === 401) {
    category = "authentication";
    const description = typeof data.error_description === "string" ? data.error_description : "";
    reason = /invalid jwt signature/i.test(description) ? "INVALID_JWT_SIGNATURE" : "AUTHENTICATION_REJECTED";
  } else if (reasons.some((item) => ["SERVICE_DISABLED", "accessNotConfigured"].includes(String(item)))) category = "api_disabled";
  else if (status === 429 || reasons.some((item) => ["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "RATE_LIMIT_EXCEEDED"].includes(String(item)))) category = "rate_limit";
  else if (status === 403) category = "permission_denied";
  else if (status === 404) category = "spreadsheet_not_found";
  else if (["ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ABORT_ERR"].includes(String(root.code ?? object(root.cause).code)) || root.name === "AbortError" || root.name === "TimeoutError") category = "network";
  else if (/^ERR_OSSL|^ERR_CRYPTO|^ERR_ASN1/.test(String(root.code))) { category = "authentication"; reason = "INVALID_PRIVATE_KEY"; }
  return new SheetsSyncError(category, reason ? { reason } : {}).info;
}
