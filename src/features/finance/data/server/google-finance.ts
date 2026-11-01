import "server-only";
import { createSheetsRequest, type SheetsRequest, type SheetsSnapshot } from "../../../dashboard/data/server/google-sheets";
import type { GoogleSheetsConfig } from "../../../dashboard/data/server/config";
import { SheetsSyncError } from "../../../dashboard/data/server/sync-error";
import { financeColumns, type FinanceCell, type FinanceMerge } from "../../types";

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
const cell = (v: unknown): v is FinanceCell => v == null || ["string", "number", "boolean"].includes(typeof v);

export async function readFinanceOverview(config: GoogleSheetsConfig, request: SheetsRequest): Promise<SheetsSnapshot> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const metadata = await request(base, { fields: "properties(locale,timeZone),sheets(properties(title),merges)" });
  if (!object(metadata) || !object(metadata.properties) || !Array.isArray(metadata.sheets)) throw new SheetsSyncError("malformed_response");
  if (!["id_ID", "id-ID", "id"].includes(String(metadata.properties.locale))) throw new SheetsSyncError("source_format", { reason: "UNSUPPORTED_LOCALE" });
  const sheet = metadata.sheets.find((item) => object(item) && object(item.properties) && item.properties.title === "Overview Finance");
  if (!object(sheet)) throw new SheetsSyncError("worksheet_missing");
  const payload = await request(`${base}/values/${encodeURIComponent("'Overview Finance'!A:Z")}`, { majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  if (!object(payload) || (payload.majorDimension !== undefined && payload.majorDimension !== "ROWS") || !Array.isArray(payload.values) || !Array.isArray(payload.values[0])) throw new SheetsSyncError("malformed_response");
  const values = payload.values as unknown[];
  const header = values[0] as unknown[];
  const mismatch = financeColumns.flatMap((name, index) => text(header[index]) !== name ? [`${String.fromCharCode(65 + index)}: ${name}`] : []);
  if (header.slice(financeColumns.length).some((v) => text(v))) mismatch.push("Header setelah K");
  if (mismatch.length) throw new SheetsSyncError("headers_mismatch", { columns: mismatch });
  const rows = values.slice(1).map((row) => {
    if (!Array.isArray(row) || !row.every(cell) || row.slice(financeColumns.length).some((v) => v != null && String(v).trim())) throw new SheetsSyncError("malformed_response");
    return Array.from({ length: financeColumns.length }, (_, i) => row[i] ?? null);
  });
  if (!rows.some((row) => row.some((value) => value != null && String(value).trim()))) throw new SheetsSyncError("empty_worksheet");
  const spkMerges: FinanceMerge[] = [], plotCodeMerges: FinanceMerge[] = [];
  if (sheet.merges !== undefined && !Array.isArray(sheet.merges)) throw new SheetsSyncError("malformed_response");
  for (const merge of (sheet.merges ?? []) as unknown[]) {
    if (!object(merge) || !((merge.startColumnIndex === 1 && merge.endColumnIndex === 2) || (merge.startColumnIndex === 2 && merge.endColumnIndex === 3))) continue;
    const start = merge.startRowIndex, end = merge.endRowIndex;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) throw new SheetsSyncError("malformed_response");
    if (start >= 1 && end > start + 1) (merge.startColumnIndex === 1 ? spkMerges : plotCodeMerges).push({ startRow: start + 1, endRow: end });
  }
  return { rows, worksheet: "Overview Finance", spkMerges, plotCodeMerges };
}
export function createFinanceReader(config: GoogleSheetsConfig) {
  const request = createSheetsRequest(config);
  return () => readFinanceOverview(config, request);
}
