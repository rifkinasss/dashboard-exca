import "server-only";
import { createSheetsRequest } from "@/features/dashboard/data/server/google-sheets";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { parsePlotPrices, type PlotPrice } from "../../lib/plot-price";

let cache: { prices: PlotPrice[]; at: number } | null = null;

export async function getPlotPrices(): Promise<PlotPrice[] | null> {
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return null;
    if (cache && Date.now() - cache.at < config.ttlSeconds * 1000) return cache.prices;
    const request = createSheetsRequest(config);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const response = await request(`${base}/values/${encodeURIComponent("'Master Harga Petak'!A5:E")}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" });
    if (!response || typeof response !== "object" || !("values" in response)) return null;
    const prices = parsePlotPrices(response.values);
    cache = { prices, at: Date.now() };
    return prices;
  } catch { return null; }
}
