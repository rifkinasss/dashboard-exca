import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeFinance } from "../../finance/lib/normalize-finance";
import { summarizeFinanceRecords } from "../../finance/lib/record-summary";
import { parseFuelWithdrawals } from "../lib/fuel-withdrawals";
import { parseFuelPriceCatalog } from "../lib/fuel-price";

const records = normalizeFinance([
  [1, "S1", "A", 1, 1000, 1000, 10, 10, 100, 1000],
  [2, "S2", "B", 1, 2000, 2000, 10, 10, 100, 2000],
]).records;
const purchases = parseFuelWithdrawals([["No", "Tanggal Ambil", "Solar", "No Petak"], [1, 46305, 10, "A", 10, 100], [2, 46305, 20, "A"], [3, 46305, 30, "B"]]);
const catalog = parseFuelPriceCatalog([["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"], [1, 46300, 10, true, ""]]);

test("summary separates matched post-tax revenue from plot purchase costs", () => {
  const summary = summarizeFinanceRecords(records, records, [2, 3], purchases, catalog, false);
  assert.equal(summary.afterTax, 2940);
  assert.equal(summary.cost, 600);
  assert.equal(summary.costCount, 3);
  assert.equal(summary.estimatedCount, 2);
  assert.equal(summary.incomplete, false);
  assert.equal(summarizeFinanceRecords(records, records, [2], purchases, catalog, false).afterTax, 980);
});

test("summary preserves unavailable and partial amounts without assigning purchases to an SPK", () => {
  assert.equal(summarizeFinanceRecords(records, records, null, purchases, catalog, false).afterTax, null);
  assert.equal(summarizeFinanceRecords(records, records, [2, 3], null, catalog, false).cost, null);
  assert.equal(summarizeFinanceRecords(records, [records[0]], [2, 3], purchases, catalog, true).cost, null);
  const partial = summarizeFinanceRecords(records, records, [2, 3], purchases, null, false);
  assert.equal(partial.cost, 100);
  assert.equal(partial.incomplete, true);
  const duplicatePlot = [...records, { ...records[0], row: 4, spk: "S3" }];
  assert.equal(summarizeFinanceRecords(duplicatePlot, [records[0]], [2, 3, 4], purchases, catalog, false).cost, null);
});
