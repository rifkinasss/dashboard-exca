import "server-only";
import { mockOverview } from "../mock-overview";
import type { DashboardData, DataSourceStatus, SyncErrorInfo } from "../source-types";
import { readSourceConfig, type DashboardSourceConfig } from "./config";
import { createGoogleSheetsReader, type SheetsSnapshot } from "./google-sheets";
import { safeSyncError } from "./sync-error";

export function createDashboardSource(config: DashboardSourceConfig, load?: () => Promise<SheetsSnapshot>, now = Date.now): () => Promise<DashboardData> {
  if (config.source === "mock") return async () => ({ kind: "ready", rows: mockOverview, status: {
    source: "mock", state: "demo", worksheet: null, lastSuccessAt: null, evaluatedAt: new Date(now()).toISOString(), ttlSeconds: config.ttlSeconds, error: null,
  } });
  const read = load ?? createGoogleSheetsReader(config);
  let cached: { value: SheetsSnapshot; at: number } | null = null;
  let failure: { error: SyncErrorInfo; at: number } | null = null;
  let pending: Promise<DashboardData> | null = null;
  const result = (): DashboardData => {
    const status: DataSourceStatus = {
      source: "google-sheets", state: failure ? cached ? "stale" : "failed" : "connected",
      worksheet: config.worksheet, lastSuccessAt: cached ? new Date(cached.at).toISOString() : null,
      evaluatedAt: new Date(now()).toISOString(), ttlSeconds: config.ttlSeconds, error: failure?.error ?? null,
    };
    return cached ? { kind: "ready", rows: cached.value.rows, status } : { kind: "error", status };
  };
  return async () => {
    if (cached && now() - cached.at < config.ttlSeconds * 1000) return result();
    if (failure && now() - failure.at < config.ttlSeconds * 1000) return result();
    if (pending) return pending;
    pending = Promise.resolve().then(read).then((value) => {
      cached = { value, at: now() };
      failure = null;
      return result();
    }).catch((error: unknown) => {
      failure = { error: safeSyncError(error), at: now() };
      return result();
    }).finally(() => { pending = null; });
    return pending;
  };
}

// shortcut: cache is per server process; use a shared store if deployment needs cross-instance synchronization.
let source: (() => Promise<DashboardData>) | undefined;
export async function getDashboardData(): Promise<DashboardData> {
  try {
    source ??= createDashboardSource(readSourceConfig(process.env));
    return await source();
  } catch (error: unknown) {
    return { kind: "error", status: { source: "google-sheets", state: "failed", worksheet: null, lastSuccessAt: null, evaluatedAt: new Date().toISOString(), ttlSeconds: 60, error: safeSyncError(error) } };
  }
}
