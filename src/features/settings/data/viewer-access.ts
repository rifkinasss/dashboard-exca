import "server-only";
import { JWT } from "google-auth-library";
import { readSourceConfig } from "@/features/dashboard/data/server/config";

export async function readAccessUsers(): Promise<{ email: string; role: "viewer" | "operator" | "admin" }[]> {
  const config = readSourceConfig(process.env);
  if (config.source !== "google-sheets") throw new Error("Source unavailable");
  const client = new JWT({ email: config.email, key: config.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const metadata = await client.request<{ sheets?: { properties?: { title?: string } }[] }>({ url: base, params: { fields: "sheets(properties(title))" }, timeout: 15000, retry: false });
  if (!metadata.data.sheets?.some((sheet) => sheet.properties?.title === "Hak Akses")) return [];
  const result = await client.request<{ values?: unknown[][] }>({ url: `${base}/values/${encodeURIComponent("'Hak Akses'!A:B")}`, params: { valueRenderOption: "FORMULA" }, timeout: 15000, retry: false });
  const rows = result.data.values ?? [];
  if (rows[0]?.[0] !== "Email" || rows[0]?.[1] !== "Peran") throw new Error("Invalid access schema");
  const users: { email: string; role: "viewer" | "operator" | "admin" }[] = [];
  for (const row of rows.slice(1)) {
    if ((row[1] !== "viewer" && row[1] !== "operator" && row[1] !== "admin") || typeof row[0] !== "string") continue;
    const email = row[0].trim().toLowerCase();
    if (!email || users.some((user) => user.email === email)) throw new Error("Invalid or duplicate access record");
    users.push({ email, role: row[1] });
  }
  return users;
}

export async function readViewers(): Promise<string[]> { return (await readAccessUsers()).map((user) => user.email); }
