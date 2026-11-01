import assert from "node:assert/strict";
import { test } from "node:test";
import { financeColumns, type RawFinanceRow } from "../../finance/types";
import { normalizeFinance } from "../../finance/lib/normalize-finance";
import { relateFinance } from "../../finance/lib/relationships";
import { allocateRevenue } from "../../finance/lib/revenue-allocation";
import { buildFinanceView } from "../../finance/lib/build-finance-view";
import { groupMonthlyEstimates } from "../../finance/lib/daily-estimate";
import { readFinanceOverview } from "../../finance/data/server/google-finance";
import { defaultFilters, filtersForPeriod } from "../lib/overview";
import { prepare, row } from "./fixtures";
import type { GoogleSheetsConfig } from "../data/server/config";

const finance = (spk: string, plot: string, overrides: Record<number, string | number | null> = {}): RawFinanceRow => {
  const values: (string | number | null)[] = [1, spk, plot, "5,0", "Rp1.000", "Rp5.000", "Rp100", "10,0", "Rp1.000", "Rp5.000", "Rp4.000"];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values;
};
const op = [
  row({ no: 1, spkNumber: "A", plotCode: "P", plotArea: 5, date: "01/10/2026", actualFuelUsage: 100 }),
  row({ no: 2, spkNumber: "A", plotCode: "P", plotArea: 5, date: "02/10/2026", actualFuelUsage: 100 }),
  row({ no: 3, spkNumber: "B", plotCode: "P", plotArea: 5, date: "01/11/2026", actualFuelUsage: 20 }),
  row({ no: 4, spkNumber: "C", plotCode: "Q", plotArea: 5, date: "02/11/2026", actualFuelUsage: 10 }),
];
const all = { ...defaultFilters, startDate: "", endDate: "" };

test("finance contract validates A-K and preserves row positions and explicit merge metadata", async () => {
  const config: GoogleSheetsConfig = { source: "google-sheets", ttlSeconds: 60, spreadsheetId: "test", worksheet: "unused", email: "test@example.test", privateKey: "not-a-key" };
  let calls = 0;
  const snapshot = await readFinanceOverview(config, async (url, params) => {
    calls++;
    if (calls === 1) return { properties: { locale: "id_ID" }, sheets: [{ properties: { title: "Overview Finance" }, merges: [{ startColumnIndex: 1, endColumnIndex: 2, startRowIndex: 1, endRowIndex: 3 }] }] };
    assert.match(decodeURIComponent(url), /Overview Finance.*A:Z/);
    assert.equal(params.valueRenderOption, "FORMATTED_VALUE");
    return { values: [financeColumns, finance("A", "P"), finance("", "P"), [], ["Total", "", "", "10"]] };
  });
  assert.deepEqual(snapshot.spkMerges, [{ startRow: 2, endRow: 3 }]);
  const normalized = normalizeFinance(snapshot.rows, { spkMerges: snapshot.spkMerges });
  assert.equal(normalized.records[1].spk, "A");
  assert.equal(normalized.records[1].spkSourceRow, 2);
  assert.equal(normalized.records[1].row, 3);
  assert.deepEqual(normalized.summaries, [5]);
  assert.equal(normalized.records.length, 2);
  await assert.rejects(readFinanceOverview(config, async () => ({ properties: { locale: "id_ID" }, sheets: [] })));
});

test("currency, missing volumes and conflicting merged identifiers are conservative", () => {
  const rows = [finance("A", "P"), finance("", "P", { 7: "", 8: "Rp0" }), finance("B", "Q")];
  const parsed = normalizeFinance(rows, { spkMerges: [{ startRow: 2, endRow: 3 }] });
  assert.equal(parsed.records[0].grossValue, 5000);
  assert.equal(parsed.records[0].fuelCost, 1000);
  assert.equal(parsed.records[1].fuelCost, null);
  assert.ok(parsed.issues.some((issue) => issue.code === "incomplete_fuel_cost" && issue.row === 3));
  const conflict = normalizeFinance(rows, { spkMerges: [{ startRow: 2, endRow: 4 }] });
  assert.equal(conflict.records[1].spk, null);
  assert.ok(conflict.issues.some((issue) => issue.code === "ambiguous_merge"));
});

test("composite relationships avoid duplicate and ambiguous plot-only matches", () => {
  const operations = prepare(op).records;
  const financial = normalizeFinance([finance("A", "P"), finance("B", "P"), finance("", "Q"), finance("D", "X")]);
  const result = relateFinance(financial.records, operations);
  assert.deepEqual(result.matched.map(({ pair }) => [pair.spk, pair.plot]), [["A", "P"], ["B", "P"], ["C", "Q"]]);
  assert.ok(result.issues.some((issue) => issue.code === "multiple_spk_per_plot"));
  assert.ok(result.issues.some((issue) => issue.code === "unmatched_finance"));
  const missing = relateFinance(normalizeFinance([finance("", "P")]).records, operations);
  assert.equal(missing.matched.length, 0);
  assert.ok(missing.issues.some((issue) => issue.code === "ambiguous_relationship"));
  const duplicates = relateFinance(normalizeFinance([finance("A", "P"), finance("A", "P")]).records, operations);
  assert.equal(duplicates.matched.length, 0);
  assert.equal(duplicates.issues.filter((issue) => issue.code === "duplicate_finance_key").length, 2);
  assert.ok(duplicates.issues.some((issue) => issue.code === "unmatched_operation"));
});

test("snapshot totals do not multiply repeated activities or attribute undated finance to a month", () => {
  const rows = [finance("A", "P"), finance("B", "P"), finance("C", "Q", { 7: "", 8: "Rp0" })];
  const full = buildFinanceView(rows, op, all);
  assert.equal(full.gross, 15000);
  assert.equal(full.fuelCost, null);
  assert.equal(full.margin, null);
  assert.equal(full.rows.length, 3);
  assert.equal(full.rows[0].gross, 5000);
  assert.equal(full.rows[0].operationRows.length, 2);
  const selected = buildFinanceView(rows, op, { ...all, selectedSpkNumbers: ["A"] });
  assert.equal(selected.gross, 5000);
  assert.equal(selected.fuelCost, 1000);
  assert.equal(selected.margin, 4000);
  assert.equal(selected.operational.summary.totals.fuel, 200);
  const october = buildFinanceView(rows, op, filtersForPeriod("2026-10"));
  assert.equal(october.gross, null);
  assert.equal(october.fuelCost, null);
  assert.equal(october.operational.summary.totals.fuel, 200);
  const duplicates = buildFinanceView([finance("A", "P"), finance("A", "P")], op, all);
  assert.equal(duplicates.gross, null);
  assert.equal(duplicates.rows.length, 2);
  assert.ok(duplicates.rows.every((row) => !row.matched));
});

test("optional hour allocation is disabled by default and reconciles only with valid hours and dates", () => {
  const rows = [{ date: "2026-10-31", hours: 1 }, { date: "2026-11-01", hours: 2 }, { date: "2026-11-02", hours: 0 }];
  assert.equal(allocateRevenue(100, rows), null);
  const allocation = allocateRevenue(100, rows, "operational_hours")!;
  assert.deepEqual(allocation.map((r) => r.date), rows.map((r) => r.date));
  assert.equal(allocation.reduce((sum, r) => sum + r.value, 0), 100);
  assert.equal(allocation[2].value, 0);
  assert.equal(allocateRevenue(100, [{ date: "2026-10-01", hours: 0 }], "operational_hours"), null);
  assert.equal(allocateRevenue(100, [{ date: null, hours: 1 }], "operational_hours"), null);
  assert.equal(allocateRevenue(100, [{ date: "2026-02-30", hours: 1 }], "operational_hours"), null);
});


test("coverage and paired revenue exclude missing, duplicate and ambiguous records", () => {
  const rows = [finance("A", "P"), finance("B", "P"), finance("C", "Q", { 7: "", 8: "Rp0" })];
  const result = buildFinanceView(rows, op, all);
  assert.deepEqual(result.grossCoverage, { value: 15000, eligibleCount: 3, totalCount: 3, missingCount: 0, complete: true });
  assert.deepEqual(result.costCoverage, { value: 2000, eligibleCount: 2, totalCount: 3, missingCount: 1, complete: false });
  assert.equal(result.marginCoverage.value, 8000);
  assert.equal(result.pairedRevenue.value, 10000);
  assert.equal(result.pairedCost.value, 2000);
  assert.equal(result.pairedRevenue.value! - result.pairedCost.value!, result.marginCoverage.value);
  const missing = buildFinanceView([finance("C", "Q", { 6: "" })], op, all);
  assert.equal(missing.costCoverage.value, null);
  assert.equal(missing.marginCoverage.value, null);
  const duplicate = buildFinanceView([finance("A", "P"), finance("A", "P"), finance("C", "Q")], op, all);
  assert.equal(duplicate.grossCoverage.value, 5000);
  assert.equal(duplicate.grossCoverage.eligibleCount, 1);
  assert.equal(duplicate.grossCoverage.totalCount, 3);
  assert.equal(duplicate.rows.length, 3);
  const filtered = buildFinanceView(rows, op, { ...all, selectedSpkNumbers: ["A", "C"], plotCodes: ["P", "Q"] });
  assert.equal(filtered.grossCoverage.value, 10000);
  assert.equal(filtered.costCoverage.value, 1000);
  const period = buildFinanceView(rows, op, filtersForPeriod("2026-10"));
  assert.equal(period.pairedRevenue.value, null);
  assert.equal(period.rows.length, 3);
});

test("daily estimates allocate across the full SPK/plot history before filtering", () => {
  const activities = [
    row({ no: 1, spkNumber: "A", plotCode: "P", date: "31/10/2026", hmStart: 100, hmEnd: 102, workingHours: 2 }),
    row({ no: 2, spkNumber: "A", plotCode: "P", date: "01/11/2026", hmStart: 102, hmEnd: 108, workingHours: 6 }),
  ];
  const full = buildFinanceView([finance("A", "P")], activities, all);
  assert.deepEqual(full.dailyEstimate.rows.map(({ date, gross, cost }) => ({ date, gross, cost })), [
    { date: "2026-10-31", gross: 1250, cost: 250 },
    { date: "2026-11-01", gross: 3750, cost: 750 },
  ]);
  const october = buildFinanceView([finance("A", "P")], activities, filtersForPeriod("2026-10"));
  assert.equal(october.dailyEstimate.rows.length, 1);
  assert.equal(october.dailyEstimate.rows[0].gross, 1250);
  assert.equal(october.gross, null);
  const missingCost = buildFinanceView([finance("A", "P", { 7: "" })], activities, all);
  assert.equal(missingCost.dailyEstimate.rows[0].cost, null);
  assert.equal(missingCost.dailyEstimate.costPairs, 0);
  const invalidHours = buildFinanceView([finance("A", "P")], [activities[0], row({ no: 2, spkNumber: "A", plotCode: "P", date: "01/11/2026", workingHours: "" })], all);
  assert.equal(invalidHours.dailyEstimate.rows.length, 0);
  assert.ok(invalidHours.dailyEstimate.issues.some((issue) => issue.code === "allocation_unavailable"));
  const duplicated = buildFinanceView([finance("A", "P"), finance("A", "P")], activities, all);
  assert.equal(duplicated.dailyEstimate.rows.length, 0);
  const single = buildFinanceView([finance("A", "P")], [activities[0]], all);
  assert.equal(single.dailyEstimate.rows.length, 1);
  assert.equal(single.dailyEstimate.rows[0].gross, 5000);
});


test("monthly estimates sum selected daily values without inventing missing costs", () => {
  const daily = [
    { date: "2026-10-30", gross: 100, cost: null },
    { date: "2026-10-31", gross: 200, cost: null },
    { date: "2026-11-01", gross: 400, cost: 50 },
    { date: "2027-01-01", gross: null, cost: 0 },
  ];
  assert.deepEqual(groupMonthlyEstimates(daily), [
    { date: "2026-10", gross: 300, cost: null },
    { date: "2026-11", gross: 400, cost: 50 },
    { date: "2027-01", gross: null, cost: 0 },
  ]);
  assert.deepEqual(groupMonthlyEstimates(daily.slice(1, 3)), [
    { date: "2026-10", gross: 200, cost: null },
    { date: "2026-11", gross: 400, cost: 50 },
  ]);
  assert.deepEqual(groupMonthlyEstimates([]), []);
});
