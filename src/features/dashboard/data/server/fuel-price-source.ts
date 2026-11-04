import "server-only";
import { FUEL_PRICE_RANGE, parseFuelPriceCatalog, type FuelPriceCatalog } from "../../lib/fuel-price";
import { readSourceConfig } from "./config";
import { createSheetsRequest } from "./google-sheets";

let cache: { data: FuelPriceCatalog; at: number } | null = null;
let pending: Promise<FuelPriceCatalog | null> | null = null;
let generation = 0;

export function invalidateFuelPriceCatalog() { cache = null; generation++; pending = null; }

export async function getFuelPriceCatalog(): Promise<FuelPriceCatalog | null> {
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return null;
    if (cache && Date.now() - cache.at < config.ttlSeconds * 1000) return cache.data;
    if (!pending) {
      const currentGeneration = generation;
      const task = (async () => {
      const request = createSheetsRequest(config);
      const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
      const read = async (range: string) => {
        const response = await request(`${base}/values/${encodeURIComponent(range)}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" });
        if (!response || typeof response !== "object" || !("values" in response)) throw new Error("Data harga tidak tersedia");
        return response.values;
      };
      const master = await read(FUEL_PRICE_RANGE);
      const data = parseFuelPriceCatalog(master);
      if (currentGeneration === generation) cache = { data, at: Date.now() };
      return data;
      })().catch(() => null).finally(() => { if (pending === task) pending = null; });
      pending = task;
    }
    return await pending;
  } catch { return null; }
}
