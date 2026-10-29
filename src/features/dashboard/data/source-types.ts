import type { RawOverviewRow } from "../types";

export type SyncErrorCategory = "configuration" | "authentication" | "spreadsheet_not_found" |
  "permission_denied" | "api_disabled" | "worksheet_missing" | "headers_mismatch" |
  "empty_worksheet" | "rate_limit" | "network" | "source_format" | "malformed_response" | "upstream";
export interface SyncErrorInfo {
  category: SyncErrorCategory;
  message: string;
  nextAction: string;
  reason?: string;
  columns?: string[];
}
export interface DataSourceStatus {
  source: "mock" | "google-sheets";
  state: "demo" | "connected" | "stale" | "failed";
  worksheet: string | null;
  lastSuccessAt: string | null;
  evaluatedAt: string;
  ttlSeconds: number;
  error: SyncErrorInfo | null;
}
export type DashboardData = { kind: "ready"; rows: RawOverviewRow[]; status: DataSourceStatus } |
  { kind: "error"; status: DataSourceStatus };
