import "server-only";
import { SheetsSyncError } from "./sync-error";

export type DashboardSourceConfig = { source: "mock"; ttlSeconds: number } | {
  source: "google-sheets";
  ttlSeconds: number;
  spreadsheetId: string;
  worksheet: string;
  email: string;
  privateKey: string;
};
export type GoogleSheetsConfig = Extract<DashboardSourceConfig, { source: "google-sheets" }>;

export function readSourceConfig(env: Readonly<Record<string, string | undefined>>): DashboardSourceConfig {
  const source = env.DASHBOARD_DATA_SOURCE?.trim();
  if (source !== "mock" && source !== "google-sheets") throw new SheetsSyncError("configuration", { reason: "DASHBOARD_DATA_SOURCE" });
  const ttl = (env.SHEETS_CACHE_TTL_SECONDS ?? "60").trim();
  if (!/^[1-9]\d*$/.test(ttl) || !Number.isSafeInteger(Number(ttl))) throw new SheetsSyncError("configuration", { reason: "SHEETS_CACHE_TTL_SECONDS" });
  if (source === "mock") return { source, ttlSeconds: Number(ttl) };
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new SheetsSyncError("configuration", { reason: name });
    return value;
  };
  const spreadsheetId = required("GOOGLE_SPREADSHEET_ID");
  const email = required("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!/^[a-zA-Z0-9_-]+$/.test(spreadsheetId)) throw new SheetsSyncError("configuration", { reason: "GOOGLE_SPREADSHEET_ID" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SheetsSyncError("configuration", { reason: "GOOGLE_SERVICE_ACCOUNT_EMAIL" });
  return { source, spreadsheetId, email, worksheet: required("GOOGLE_SHEET_NAME"), privateKey: required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"), ttlSeconds: Number(ttl) };
}
