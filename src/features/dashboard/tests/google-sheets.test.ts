import assert from "node:assert/strict";
import { test } from "node:test";
import { overviewColumns } from "../types";
import { createDashboardSource } from "../data/server/dashboard-source";
import { readSourceConfig, type GoogleSheetsConfig } from "../data/server/config";
import { mapOverviewValues, readGoogleOverview, sheetsReadScope } from "../data/server/google-sheets";
import { safeSyncError, SheetsSyncError } from "../data/server/sync-error";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { defaultFilters, filtersForPeriod } from "../lib/overview";
import { fixture, row } from "./fixtures";

const headers = overviewColumns.map((column) => column.header);
const config: GoogleSheetsConfig = { source: "google-sheets", spreadsheetId: "synthetic-id", worksheet: "New Version Overview", email: "test@example.invalid", privateKey: "synthetic-test-key", ttlSeconds: 60 };
const metadata = { properties: { locale: "id_ID", timeZone: "Asia/Makassar" }, sheets: [{ properties: { title: config.worksheet } }] };
const snapshot = () => ({ rows: fixture, worksheet: config.worksheet });

test("repository maps A–O without collapsing blank/partial rows or changing primitive cells", () => {
  const input = { majorDimension: "ROWS", values: [headers, row(), [], [2, " PTK-02 ", "", null, "02/10/2026"]] };
  const before = structuredClone(input);
  const rows = mapOverviewValues(input);
  assert.equal(rows.length, 3);
  assert.equal(rows[1].length, 15);
  assert.equal(rows[2][1], " PTK-02 ");
  assert.equal(rows[2][2], "");
  assert.equal(rows[2][14], null);
  const view = buildDashboardViewModel(rows, defaultFilters, { worksheetName: config.worksheet });
  assert.equal(view.records[2].source.row, 4);
  assert.equal(view.records[2].source.worksheet, config.worksheet);
  assert.deepEqual(input, before);
});

test("header validation accepts whitespace but rejects reordered, missing, or renamed columns", () => {
  assert.equal(mapOverviewValues({ values: [headers.map((header) => `  ${header}  `), row()] }).length, 1);
  for (const altered of [[...headers.slice(1), headers[0]], headers.slice(0, 14), headers.map((header, index) => index === 9 ? "Changed" : header)]) {
    assert.throws(() => mapOverviewValues({ values: [altered, row()] }), (error: unknown) => error instanceof SheetsSyncError && error.info.category === "headers_mismatch");
  }
});

test("empty worksheet, malformed payloads, objects and oversized rows fail explicitly", () => {
  for (const payload of [{}, { values: [] }, { values: [headers] }, { values: [headers, [], [""]] }]) {
    assert.throws(() => mapOverviewValues(payload), (error: unknown) => error instanceof SheetsSyncError && error.info.category === "empty_worksheet");
  }
  for (const payload of [null, { values: {} }, { values: [headers, "row"] }, { values: [headers, [{}]] }, { values: [headers, [...row(), "extra"]] }, { majorDimension: "COLUMNS", values: [headers, row()] }]) {
    assert.throws(() => mapOverviewValues(payload), (error: unknown) => error instanceof SheetsSyncError && error.info.category === "malformed_response");
  }
});

test("API reads metadata then open-ended A:O using FORMATTED_VALUE and readonly scope", async () => {
  const calls: { url: string; params: Record<string, string> }[] = [];
  const result = await readGoogleOverview(config, async (url, params) => {
    calls.push({ url, params });
    return calls.length === 1 ? metadata : { values: [headers, ...fixture] };
  });
  assert.equal(calls.length, 2);
  assert.match(decodeURIComponent(calls[1].url), /'New Version Overview'!A:O$/);
  assert.equal(calls[1].params.valueRenderOption, "FORMATTED_VALUE");
  assert.equal(calls[1].params.majorDimension, "ROWS");
  assert.equal(sheetsReadScope, "https://www.googleapis.com/auth/spreadsheets.readonly");
  assert.deepEqual(result.rows, fixture);
  assert.equal(result.worksheet, config.worksheet);
});

test("worksheet absence and incompatible locale fail without fallback or locale guessing", async () => {
  await assert.rejects(readGoogleOverview(config, async () => ({ ...metadata, sheets: [] })), (error: unknown) => error instanceof SheetsSyncError && error.info.category === "worksheet_missing");
  await assert.rejects(readGoogleOverview(config, async () => ({ ...metadata, properties: { locale: "en_US" } })), (error: unknown) => error instanceof SheetsSyncError && error.info.category === "source_format");
});

test("worksheet names with apostrophes use escaped A1 notation", async () => {
  const special = { ...config, worksheet: "Area's Overview" };
  let count = 0;
  await readGoogleOverview(special, async (url) => {
    if (++count === 1) return { ...metadata, sheets: [{ properties: { title: special.worksheet } }] };
    assert.match(decodeURIComponent(url), /'Area''s Overview'!A:O$/);
    return { values: [headers, row()] };
  });
});

test("Google failure categories expose only sanitized diagnostic information", () => {
  const cases = [
    [{ response: { status: 400, data: { error: "invalid_grant", error_description: "Invalid JWT Signature. SECRET" } } }, "authentication"],
    [{ response: { status: 401 } }, "authentication"],
    [{ response: { status: 403 } }, "permission_denied"],
    [{ response: { status: 403, data: { error: { details: [{ reason: "SERVICE_DISABLED" }] } } } }, "api_disabled"],
    [{ response: { status: 404 } }, "spreadsheet_not_found"],
    [{ response: { status: 429 } }, "rate_limit"],
    [{ response: { status: 403, data: { error: { errors: [{ reason: "userRateLimitExceeded" }] } } } }, "rate_limit"],
    [{ code: "ENOTFOUND" }, "network"],
    [{ cause: { code: "EHOSTUNREACH" } }, "network"],
    [{ name: "AbortError" }, "network"],
    [{ code: "ERR_OSSL_UNSUPPORTED" }, "authentication"],
    [{ response: { status: 503 } }, "upstream"],
  ] as const;
  for (const [error, expected] of cases) {
    const info = safeSyncError({ ...error, message: "SECRET", request: { Authorization: "SECRET" } });
    assert.equal(info.category, expected);
    assert.ok(!JSON.stringify(info).includes("SECRET"));
  }
  assert.equal(safeSyncError(cases[0][0]).reason, "INVALID_JWT_SIGNATURE");
});

test("source selection is explicit; credentials and positive TTL are validated server-side", () => {
  const env = { DASHBOARD_DATA_SOURCE: "google-sheets", GOOGLE_SPREADSHEET_ID: "synthetic-id", GOOGLE_SHEET_NAME: "New Version Overview", GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@example.invalid", GOOGLE_PRIVATE_KEY: "synthetic\\nkey" };
  const selected = readSourceConfig(env);
  assert.equal(selected.source, "google-sheets");
  assert.equal(selected.ttlSeconds, 60);
  if (selected.source === "google-sheets") assert.equal(selected.privateKey, "synthetic\nkey");
  assert.deepEqual(readSourceConfig({ DASHBOARD_DATA_SOURCE: "mock" }), { source: "mock", ttlSeconds: 60 });
  for (const bad of [{}, { DASHBOARD_DATA_SOURCE: "other" }, { ...env, GOOGLE_PRIVATE_KEY: "" }, { ...env, GOOGLE_SPREADSHEET_ID: "https://not-an-id" }, { ...env, SHEETS_CACHE_TTL_SECONDS: "0" }, { ...env, SHEETS_CACHE_TTL_SECONDS: "NaN" }]) {
    assert.throws(() => readSourceConfig(bad), SheetsSyncError);
  }
});

test("TTL cache reuses snapshots, coalesces concurrent loads and reads appended rows after expiry", async () => {
  let now = 0;
  let reads = 0;
  const source = createDashboardSource(config, async () => {
    reads++;
    return reads === 1 ? snapshot() : { ...snapshot(), rows: [...fixture, row({ no: 9, date: "03/10/2026" })] };
  }, () => now);
  const batch = await Promise.all([source(), source(), source()]);
  assert.equal(reads, 1);
  assert.equal(batch[0].status.state, "connected");
  now = 59999;
  await source();
  assert.equal(reads, 1);
  now = 60000;
  const updated = await source();
  assert.equal(reads, 2);
  assert.equal(updated.kind, "ready");
  if (updated.kind === "ready") assert.equal(updated.rows.length, 5);
});

test("refresh failure keeps a stale snapshot and original last-success time; failures are cooled down", async () => {
  let now = 0;
  let reads = 0;
  const source = createDashboardSource(config, async () => {
    reads++;
    if (reads === 2) throw { response: { status: 429 }, message: "SECRET" };
    return snapshot();
  }, () => now);
  const first = await source();
  now = 60000;
  const failed = await source();
  assert.equal(failed.kind, "ready");
  assert.equal(failed.status.state, "stale");
  assert.equal(failed.status.lastSuccessAt, first.status.lastSuccessAt);
  assert.equal(failed.status.error?.category, "rate_limit");
  now = 61000;
  await source();
  assert.equal(reads, 2);
  now = 120000;
  const recovered = await source();
  assert.equal(recovered.status.state, "connected");
  assert.equal(recovered.status.error, null);
});

test("cold live failure never switches to mock; mock mode never calls Google", async () => {
  let calls = 0;
  const live = createDashboardSource(config, async () => { calls++; throw new SheetsSyncError("authentication", { reason: "INVALID_JWT_SIGNATURE" }); }, () => 0);
  const result = await live();
  assert.equal(result.kind, "error");
  assert.equal(result.status.state, "failed");
  assert.equal(result.status.source, "google-sheets");
  assert.equal(result.status.lastSuccessAt, null);
  await live();
  assert.equal(calls, 1);
  const mock = createDashboardSource({ source: "mock", ttlSeconds: 60 }, async () => { throw new Error("must not call"); });
  const demo = await mock();
  assert.equal(demo.kind, "ready");
  assert.equal(demo.status.state, "demo");
});

test("repository snapshots enter Phase 2 unchanged; local filtering never reloads the repository", async () => {
  let calls = 0;
  const source = createDashboardSource(config, async () => {
    calls++;
    return { worksheet: config.worksheet, rows: mapOverviewValues({ values: [headers, ...fixture] }) };
  });
  const data = await source();
  assert.equal(data.kind, "ready");
  if (data.kind !== "ready") return;
  const all = buildDashboardViewModel(data.rows, defaultFilters, { worksheetName: config.worksheet });
  assert.equal(all.summary.totals.fuel, 190);
  assert.equal(all.summary.totals.efficiency, 190 / 15);
  assert.equal(all.records[0].source.worksheet, config.worksheet);
  assert.ok(all.issues.length > 0);
  const selected = buildDashboardViewModel(data.rows, { ...defaultFilters, statuses: ["Ditunda"] });
  assert.equal(selected.summary.totals.plotCount, 1);
  assert.equal(calls, 1);
});

test("live initial period handles leap months and does not force October demo dates", () => {
  assert.deepEqual(filtersForPeriod("2024-02"), { startDate: "2024-02-01", endDate: "2024-02-29", plotCodes: [], statuses: [] });
  assert.equal(filtersForPeriod("2026-04").endDate, "2026-04-30");
  assert.throws(() => filtersForPeriod("2026-13"), RangeError);
});
