import "server-only";
import { createSheetsRequest } from "@/features/dashboard/data/server/google-sheets";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { spkDocumentHeaders, type SpkDocumentRecord } from "../../lib/spk-document-folders";

export const spkDocumentWorksheet = "Administrasi SPK";

export function spkDocumentWriterReady() {
  return process.env.ENABLE_SPK_DOCUMENT_WRITES === "true" &&
    process.env.GOOGLE_SPREADSHEET_ID?.replace(/^\"|\"$/g, "") === "18UpYEKlrgZnuRyYoGwu8P4pAQqdBtgvxRkMjMYVCSgo" &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

export async function readSpkDocumentRecords(): Promise<SpkDocumentRecord[]> {
  const config = readSourceConfig(process.env);
  if (config.source !== "google-sheets") throw new Error("Sumber bukan Google Sheets.");
  const request = createSheetsRequest(config);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const metadata = await request(base, { fields: "sheets(properties(title))" }) as { sheets?: { properties?: { title?: string } }[] };
  if (!metadata.sheets?.some((sheet) => sheet.properties?.title === spkDocumentWorksheet)) throw new Error("Worksheet Administrasi SPK tidak ditemukan.");
  const response = await request(`${base}/values/${encodeURIComponent(`'${spkDocumentWorksheet}'!A:H`)}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }) as { values?: unknown[][] };
  const rows = response.values ?? [];
  if (!spkDocumentHeaders.every((header, index) => rows[0]?.[index] === header)) throw new Error("Header worksheet administrasi SPK tidak sesuai.");
  return rows.slice(1).filter(([number]) => typeof number === "number" || (typeof number === "string" && number.trim())).map((row) => ({
    number: String(row[0] ?? "").trim(), spkUrl: String(row[1] ?? ""), beritaAcaraNumber: String(row[2] ?? ""), beritaAcaraUrl: String(row[3] ?? ""),
    payoutNumber: String(row[4] ?? ""), payoutUrl: String(row[5] ?? ""), updatedAt: String(row[6] ?? ""), updatedBy: String(row[7] ?? ""),
  }));
}
