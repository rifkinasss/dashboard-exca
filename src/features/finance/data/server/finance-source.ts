import "server-only";
import { createDashboardSource } from "../../../dashboard/data/server/dashboard-source";
import { readSourceConfig, type GoogleSheetsConfig } from "../../../dashboard/data/server/config";
import { safeSyncError } from "../../../dashboard/data/server/sync-error";
import type { DashboardData } from "../../../dashboard/data/source-types";
import { createFinanceReader } from "./google-finance";

let source: (() => Promise<DashboardData>) | undefined;
export async function getFinanceData(): Promise<DashboardData | null> {
  try {
    const config = readSourceConfig(process.env);
    if (config.source === "mock") return null;
    const financeConfig: GoogleSheetsConfig = { ...config, worksheet: "Overview Finance" };
    source ??= createDashboardSource(financeConfig, createFinanceReader(financeConfig));
    return await source();
  } catch (error) {
    return { kind: "error", status: { source: "google-sheets", state: "failed", worksheet: "Overview Finance", lastSuccessAt: null, evaluatedAt: new Date().toISOString(), ttlSeconds: 60, error: safeSyncError(error) } };
  }
}
