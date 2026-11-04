import "server-only";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { createSheetsRequest } from "@/features/dashboard/data/server/google-sheets";
import { parseAppearance } from "../lib/appearance";

export async function getAppearance() {
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return null;
    const request = createSheetsRequest(config);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const result = await request(`${base}/values/${encodeURIComponent("'Pengaturan'!A1:B3")}`, { majorDimension: "ROWS", valueRenderOption: "FORMULA" });
    if (!result || typeof result !== "object" || !("values" in result)) return null;
    return parseAppearance(result.values);
  } catch { return null; }
}
