import assert from "node:assert/strict";
import { test } from "node:test";
import { fuelWithdrawalDifference, parseFuelWithdrawals, selectPlotPurchases, selectPlotPurchasesOnDate, summarizeFuelWithdrawals, summarizePlotPurchases } from "../lib/fuel-withdrawals";

test("withdrawal difference preserves negative values and unavailable data", () => {
  assert.equal(fuelWithdrawalDifference(2750, 2290), 460);
  assert.equal(fuelWithdrawalDifference(100, 150), -50);
  assert.equal(fuelWithdrawalDifference(0, 0), 0);
  assert.equal(fuelWithdrawalDifference(null, 100), null);
  assert.equal(fuelWithdrawalDifference(100, null), null);
});
import { parseFuelPriceCatalog, resolveWithdrawalPricing } from "../lib/fuel-price";
import { defaultFilters } from "../lib/overview";

const filters = { ...defaultFilters, startDate: "", endDate: "" };
const header = ["No", "Tanggal Ambil", "Solar", "No Petak"];

test("activity purchases match both plot and date and retain multiple transactions", () => {
  const data = parseFuelWithdrawals([header, [1, 46305, 100, "A"], [2, 46305, 50, "A"], [3, 46305, 200, "B"], [4, 46306, 300, "A"]]);
  assert.deepEqual(selectPlotPurchasesOnDate(data, "a", data.records[0].date).map((row) => row.liters), [50, 100]);
  assert.deepEqual(selectPlotPurchasesOnDate(data, "A", ""), []);
  assert.deepEqual(selectPlotPurchasesOnDate(data, "", data.records[0].date), []);
});

test("withdrawals preserve source rows, ignore repeated headers and flag invalid records", () => {
  const data = parseFuelWithdrawals([header, [1, 46305, 100, " A "], [], header, [1, 46306, 150, "B"], [2, 46307, -2, "A"]]);
  assert.deepEqual(data.records.map(({ plotCode, sourceRow }) => [plotCode, sourceRow]), [["A", 5], ["B", 8]]);
  assert.deepEqual(data.invalidRows, [9]);
  assert.equal(summarizeFuelWithdrawals(data, filters, ["A", "B"]).value, 250);
  assert.match(summarizeFuelWithdrawals(data, filters, ["A"]).note, /tidak cocok/);
  assert.throws(() => parseFuelWithdrawals([["No", "Solar"]]));
});

test("withdrawals respect dates and exact plot codes without inventing SPK or status attribution", () => {
  const data = parseFuelWithdrawals([header, [1, 46305, 100, "A"], [2, 46306, 150, "B"]]);
  assert.equal(summarizeFuelWithdrawals(data, { ...filters, plotCodes: ["A"] }, ["A", "B"]).value, 100);
  assert.equal(summarizeFuelWithdrawals(data, { ...filters, startDate: data.records[1].date }, ["A", "B"]).value, 150);
  assert.equal(summarizeFuelWithdrawals(data, { ...filters, selectedSpkNumbers: ["S"] }, ["A", "B"]).value, null);
  assert.equal(summarizeFuelWithdrawals(data, { ...filters, statuses: ["Selesai"] }, ["A", "B"]).value, null);
});


test("reads recorded price snapshots and flags incomplete or conflicting values without discarding liters", () => {
  const data = parseFuelWithdrawals([header, [1, 46305, 100, "A", 24500, 2450000], [2, 46306, 150, "B"], [3, 46307, 100, "C", 24500, 1]]);
  assert.deepEqual(data.records.map(({ price, cost, priceInvalid }) => [price, cost, priceInvalid]), [[24500, 2450000, false], [null, null, false], [24500, 1, true]]);
  assert.equal(summarizeFuelWithdrawals(data, filters, ["A", "B", "C"]).value, 350);
});

test("plot purchases sum only matching source transactions and expose unavailable or incomplete data", () => {
  const data = parseFuelWithdrawals([header, [1, 46305, 100, " A "], [2, 46306, 150, "a"], [3, 46306, 90, "AB"], [4, 46307, -1, "A"]]);
  assert.deepEqual(summarizePlotPurchases(data, "a"), { liters: 250, count: 2, invalidRows: 1, available: true });
  assert.deepEqual(summarizePlotPurchases(data, "B"), { liters: null, count: 0, invalidRows: 1, available: true });
  assert.deepEqual(summarizePlotPurchases(null, "A"), { liters: null, count: 0, invalidRows: 0, available: false });
});

test("plot history uses only matching transactions and applies the approved price effective on each date", () => {
  const data = parseFuelWithdrawals([header, [1, 46305, 100, "A"], [2, 46306, 150, "B"], [3, 46307, 50, "A", 25000, 1250000]]);
  const catalog = parseFuelPriceCatalog([["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"], [1, 46300, 24500, true, ""], [2, 46306, 27000, false, ""]]);
  const rows = selectPlotPurchases(data, "a");
  assert.deepEqual(rows.map((row) => row.sourceRow), [7, 5]);
  assert.deepEqual(resolveWithdrawalPricing(rows[0], catalog), { kind: "recorded", price: 25000, cost: 1250000 });
  assert.deepEqual(resolveWithdrawalPricing(rows[1], catalog), { kind: "estimated", price: 24500, cost: 2450000 });
  assert.equal(resolveWithdrawalPricing(rows[1], null).kind, "unavailable");
});
