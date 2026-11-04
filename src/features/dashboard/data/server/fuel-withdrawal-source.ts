import "server-only";
import { parseFuelWithdrawals, type FuelWithdrawalData } from "../../lib/fuel-withdrawals";
import { readSourceConfig } from "./config";
import { createSheetsRequest } from "./google-sheets";

let cache: { data: FuelWithdrawalData; at: number } | null = null;
let pending: Promise<FuelWithdrawalData | null> | null = null;
let generation = 0;

export function invalidateFuelWithdrawals() { cache = null; generation++; pending = null; }

export async function getFuelWithdrawals(): Promise<FuelWithdrawalData | null> {
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return null;
    if (cache && Date.now() - cache.at < config.ttlSeconds * 1000) return cache.data;
    if (!pending) {
      const currentGeneration = generation;
      const request = (async () => {
        const sheetsRequest = createSheetsRequest(config);
        const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
        const result = await sheetsRequest(`${base}/values/${encodeURIComponent("'Pengambilan Solar'!A4:F")}`, { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" });
        if (!result || typeof result !== "object" || !("values" in result)) throw new Error("Data tidak tersedia");
        const data = parseFuelWithdrawals(result.values);
        if (currentGeneration === generation) cache = { data, at: Date.now() };
        return data;
      })().catch(() => null).finally(() => { if (pending === request) pending = null; });
      pending = request;
    }
    return await pending;
  } catch { return null; }
}
