import "server-only";
import { JWT } from "google-auth-library";
import { overviewColumns, type PlotCodeMerge, type RawCell, type RawOverviewRow } from "../../types";
import type { GoogleSheetsConfig } from "./config";
import { SheetsSyncError } from "./sync-error";
import { isPlot2026Date, parsePlotSheet, plot2026Worksheet } from "../../../management/lib/plot-sheet";
import { parseOverviewDate } from "../../lib/normalize-overview";

export const sheetsReadScope = "https://www.googleapis.com/auth/spreadsheets.readonly";
export type SheetsRequest = (url: string, params: Record<string, string>) => Promise<unknown>;
export interface SheetsSnapshot { rows: RawOverviewRow[]; worksheet: string; plotCodeMerges?: PlotCodeMerge[]; spkMerges?: PlotCodeMerge[]; }

const isCell = (value: unknown): value is RawCell => value == null || ["string", "number", "boolean"].includes(typeof value);
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const headerText = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

export function mapOverviewValues(payload: unknown): RawOverviewRow[] {
  if (!isObject(payload) || (payload.majorDimension !== undefined && payload.majorDimension !== "ROWS")) throw new SheetsSyncError("malformed_response");
  if (payload.values === undefined) throw new SheetsSyncError("empty_worksheet");
  if (!Array.isArray(payload.values)) throw new SheetsSyncError("malformed_response");
  const values: unknown[] = payload.values;
  if (!values.length) throw new SheetsSyncError("empty_worksheet");
  if (!Array.isArray(values[0])) throw new SheetsSyncError("malformed_response");
  const header: unknown[] = values[0];
  const mismatches = overviewColumns.filter((column, index) => headerText(header[index]) !== column.header).map((column) => `${column.column}: ${column.header}`);
  if (header.length > overviewColumns.length) mismatches.push("Header setelah P");
  if (mismatches.length) throw new SheetsSyncError("headers_mismatch", { columns: mismatches });
  const rows = values.slice(1).map((row): RawOverviewRow => {
    if (!Array.isArray(row) || row.length > overviewColumns.length || !row.every(isCell)) throw new SheetsSyncError("malformed_response");
    return Array.from({ length: overviewColumns.length }, (_, index) => row[index] ?? null);
  });
  if (!rows.some((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))) throw new SheetsSyncError("empty_worksheet");
  return rows;
}

export async function readGoogleOverview(config: GoogleSheetsConfig, request: SheetsRequest): Promise<SheetsSnapshot> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const metadata = await request(base, { fields: "properties(locale,timeZone),sheets(properties(title),merges)" });
  if (!isObject(metadata) || !Array.isArray(metadata.sheets) || !isObject(metadata.properties)) throw new SheetsSyncError("malformed_response");
  const sheet = metadata.sheets.find((item) => isObject(item) && isObject(item.properties) && item.properties.title === config.worksheet);
  if (!isObject(sheet)) throw new SheetsSyncError("worksheet_missing");
  if (!["id_ID", "id-ID", "id"].includes(String(metadata.properties.locale))) throw new SheetsSyncError("source_format", { reason: "UNSUPPORTED_LOCALE" });
  if (config.worksheet === plot2026Worksheet) {
    const range = `'${plot2026Worksheet}'!A:L`;
    const payload = await request(`${base}/values/${encodeURIComponent(range)}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" });
    return { rows: mapPlot2026Overview(payload), worksheet: config.worksheet };
  }
  const range = `'${config.worksheet.replaceAll("'", "''")}'!A:P`;
  const payload = await request(`${base}/values/${encodeURIComponent(range)}`, { majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  const plotCodeMerges: PlotCodeMerge[] = [];
  const spkMerges: PlotCodeMerge[] = [];
  if (sheet.merges !== undefined && !Array.isArray(sheet.merges)) throw new SheetsSyncError("malformed_response");
  if (Array.isArray(sheet.merges)) for (const merge of sheet.merges) {
    if (!isObject(merge) || !((merge.startColumnIndex === 2 && merge.endColumnIndex === 3) || (merge.startColumnIndex === 1 && merge.endColumnIndex === 2))) continue;
    const start = merge.startRowIndex;
    const end = merge.endRowIndex;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) throw new SheetsSyncError("malformed_response");
    if (start >= 1 && end > start + 1) (merge.startColumnIndex === 1 ? spkMerges : plotCodeMerges).push({ startRow: start + 1, endRow: end });
  }
  return { rows: mapOverviewValues(payload), worksheet: config.worksheet, plotCodeMerges, spkMerges };
}

export function mapPlot2026Overview(payload: unknown, allowEmpty = false): RawOverviewRow[] {
  if (!isObject(payload) || (payload.majorDimension !== undefined && payload.majorDimension !== "ROWS")) throw new SheetsSyncError("malformed_response");
  if (!Array.isArray(payload.values) || !payload.values.length) throw new SheetsSyncError("empty_worksheet");
  const values = payload.values.map((row): RawCell[] => {
    if (!Array.isArray(row) || row.length > 12 || !row.every(isCell)) throw new SheetsSyncError("malformed_response");
    return row;
  });
  const plots = parsePlotSheet(values);
  const plotActivityHeaders = [overviewColumns[0], ...overviewColumns.slice(5)];
  if ((!allowEmpty && !plots.length) || plots.some((plot) => plotActivityHeaders.some(({ header }, index) => headerText(values[plot.sourceRow + 5]?.[index]) !== header))) {
    throw new SheetsSyncError("headers_mismatch");
  }

  // Leave gaps for metadata, headers and totals so trace links keep their physical sheet rows.
  const rows: RawOverviewRow[] = values.slice(1).map(() => []);
  for (const plot of plots) {
    const activities = plot.activities.flatMap((activity) => {
      const raw = values[activity.sourceRow - 1];
      const date = parseOverviewDate(typeof raw[1] === "number" ? activity.date : raw[1]);
      return date.state === "valid" && !isPlot2026Date(date.value) ? [] : [{ activity, raw, date }];
    });
    const totalFuel = values[plot.sourceRow + 3]?.[2];
    if (!activities.length) {
      rows[plot.sourceRow - 2] = [null, plot.spk, plot.code, plot.area, totalFuel];
    }
    for (const [index, { activity, raw, date }] of activities.entries()) {
      rows[activity.sourceRow - 2] = [raw[0], plot.spk, plot.code, index === 0 ? plot.area : null, index === 0 ? totalFuel : null,
        date.value ?? raw[1], ...raw.slice(2, 12)];
    }
  }
  return rows;
}

export function createSheetsRequest(config: GoogleSheetsConfig): SheetsRequest {
  const auth = new JWT({ email: config.email, key: config.privateKey, scopes: [sheetsReadScope], transporterOptions: { timeout: 15000, retry: false } });
  return async (url, params) => {
    const response = await auth.request<unknown>({ url, params, method: "GET", timeout: 15000, retry: false });
    return response.data;
  };
}

export function createGoogleSheetsReader(config: GoogleSheetsConfig): () => Promise<SheetsSnapshot> {
  const request = createSheetsRequest(config);
  return () => readGoogleOverview(config, request);
}
