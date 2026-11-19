import "server-only";
import { createSheetsRequest, type SheetsRequest, type SheetsSnapshot } from "../../../dashboard/data/server/google-sheets";
import type { GoogleSheetsConfig } from "../../../dashboard/data/server/config";
import { SheetsSyncError } from "../../../dashboard/data/server/sync-error";
import { allOverviewColumns, financeColumns, type FinanceCell, type FinanceMerge } from "../../types";

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
const cell = (v: unknown): v is FinanceCell => v == null || ["string", "number", "boolean"].includes(typeof v);

export async function readFinanceOverview(config: GoogleSheetsConfig, request: SheetsRequest): Promise<SheetsSnapshot> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const metadata = await request(base, { fields: "properties(locale,timeZone),sheets(properties(title),merges)" });
  if (!object(metadata) || !object(metadata.properties) || !Array.isArray(metadata.sheets)) throw new SheetsSyncError("malformed_response");
  if (!["id_ID", "id-ID", "id"].includes(String(metadata.properties.locale))) throw new SheetsSyncError("source_format", { reason: "UNSUPPORTED_LOCALE" });
  const sheet = metadata.sheets.find((item) => object(item) && object(item.properties) && item.properties.title === config.worksheet);
  if (!object(sheet)) throw new SheetsSyncError("worksheet_missing");
  const worksheet = `'${config.worksheet.replaceAll("'", "''")}'!`;
  const valuesUrl = (range: string) => `${base}/values/${encodeURIComponent(worksheet + range)}`;
  const payload = await request(valuesUrl("A:Z"), { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" });
  if (!object(payload) || (payload.majorDimension !== undefined && payload.majorDimension !== "ROWS") || !Array.isArray(payload.values) || !Array.isArray(payload.values[0])) throw new SheetsSyncError("malformed_response");
  const values = payload.values as unknown[];
  const header = values[0] as unknown[];
  const useCombinedOverview = text(header[1]) === "No. SPK" && text(header[7]) === "Kode Petak";
  const schema = useCombinedOverview ? allOverviewColumns : financeColumns;
  const mismatch = schema.flatMap((name, index) => text(header[index]) !== name ? [`${String.fromCharCode(65 + index)}: ${name}`] : []);
  if (header.slice(schema.length).some((v) => text(v))) mismatch.push(`Header setelah ${String.fromCharCode(64 + schema.length)}`);
  if (mismatch.length) throw new SheetsSyncError("headers_mismatch", { columns: mismatch });
  const sourceRows = values.slice(1).map((row) => {
    if (!Array.isArray(row) || !row.every(cell) || row.slice(schema.length).some((v) => v != null && String(v).trim())) throw new SheetsSyncError("malformed_response");
    return row as FinanceCell[];
  });
  const plotColumn = useCombinedOverview ? 7 : 2;
  let formattedIds: unknown[] = [];
  if (sourceRows.some((row) => typeof row[1] === "number" || typeof row[plotColumn] === "number")) {
    // Only identifiers use display formatting, which may include leading zeroes.
    const result = await request(valuesUrl(`B2:${useCombinedOverview ? "H" : "C"}${values.length}`), { majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
    if (!object(result) || !Array.isArray(result.values)) throw new SheetsSyncError("malformed_response");
    formattedIds = result.values;
  }
  const rows = sourceRows.map((row, index) => {
    const formatted = formattedIds[index];
    const identifier = (column: number) =>
      typeof row[column] === "number" && Array.isArray(formatted) ? text(formatted[column - 1]) || row[column] : row[column];
    if (!useCombinedOverview) return Array.from({ length: financeColumns.length }, (_, i) => (i === 1 || i === 2 ? identifier(i) : row[i]) ?? null);
    const plot = identifier(plotColumn);
    if (!String(plot ?? "").trim() || !String(row[8] ?? "").trim() || !String(row[10] ?? "").trim()) return [];
    return [row[0], identifier(1), plot, row[8], row[9], row[10], row[15], row[12], row[16], row[10], row[11]];
  });
  if (!rows.some((row) => row.some((value) => value != null && String(value).trim()))) throw new SheetsSyncError("empty_worksheet");
  const spkMerges: FinanceMerge[] = [], plotCodeMerges: FinanceMerge[] = [];
  if (sheet.merges !== undefined && !Array.isArray(sheet.merges)) throw new SheetsSyncError("malformed_response");
  for (const merge of (useCombinedOverview ? [] : sheet.merges ?? []) as unknown[]) {
    if (!object(merge) || !((merge.startColumnIndex === 1 && merge.endColumnIndex === 2) || (merge.startColumnIndex === 2 && merge.endColumnIndex === 3))) continue;
    const start = merge.startRowIndex, end = merge.endRowIndex;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) throw new SheetsSyncError("malformed_response");
    if (start >= 1 && end > start + 1) (merge.startColumnIndex === 1 ? spkMerges : plotCodeMerges).push({ startRow: start + 1, endRow: end });
  }
  return { rows, worksheet: config.worksheet, spkMerges, plotCodeMerges };
}
export function createFinanceReader(config: GoogleSheetsConfig) {
  const request = createSheetsRequest(config);
  return () => readFinanceOverview(config, request);
}
