import "server-only";
import { createSheetsRequest } from "@/features/dashboard/data/server/google-sheets";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import {
  parsePlotSheet,
  isPlot2026Date,
  plot2026Worksheet,
  plotSheetRange,
  type SheetPlot,
} from "../../lib/plot-sheet";

export function plotWorksheetName(env: Record<string, string | undefined>) {
  const name = env.PLOT_OPERATIONAL_SHEET_NAME?.trim();
  const overview = env.GOOGLE_SHEET_NAME?.trim();
  if (name === plot2026Worksheet && (overview === plot2026Worksheet || overview === "Overview Operasional")) return name;
  return env.FUEL_TESTING_ONLY === "true" && name === "Okt 2026 - testing"
    ? name
    : null;
}

export async function readPlotSheet(): Promise<SheetPlot[]> {
  const config = readSourceConfig(process.env);
  if (config.source !== "google-sheets")
    throw new Error("Sumber bukan Google Sheets.");
  const worksheet = plotWorksheetName(process.env);
  if (!worksheet)
    throw new Error("Worksheet petak belum dikonfigurasi.");
  const request = createSheetsRequest(config);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const metadata = (await request(base, {
    fields: "properties(locale),sheets(properties(title),merges)",
  })) as {
    properties?: { locale?: string };
    sheets?: { properties?: { title?: string }; merges?: unknown[] }[];
  };
  const sheet = metadata.sheets?.find(
    (item) => item.properties?.title === worksheet,
  );
  if (
    !sheet ||
    !["id_ID", "id-ID", "id"].includes(metadata.properties?.locale ?? "")
  )
    throw new Error("Worksheet petak tidak dapat diverifikasi.");
  const values = (await request(
    `${base}/values/${encodeURIComponent(plotSheetRange(worksheet, "A:L"))}`,
    { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" },
  )) as { values?: unknown[][] };
  if (!Array.isArray(values.values))
    throw new Error("Data petak kosong atau tidak terbaca.");
  const plots = parsePlotSheet(values.values);
  if (worksheet !== plot2026Worksheet) return plots;
  return plots.map((plot) => ({ ...plot, activities: plot.activities.filter(({ date }) => date === null || isPlot2026Date(date)) }));
}
