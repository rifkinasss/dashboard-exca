import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizePurchaseCosts, type FuelPriceCatalog } from "../lib/fuel-price";

const catalog: FuelPriceCatalog = { prices: [{ effectiveDate: "2026-10-05", rupiahPerLiter: 25000 }], records: [], issues: [] };
const rows = [
  { date: "2026-10-10", liters: 100, price: 24000, cost: 2400000, priceInvalid: false },
  { date: "2026-10-11", liters: 150, price: null, cost: null, priceInvalid: false },
  { date: "2026-10-12", liters: 50, price: null, cost: null, priceInvalid: true },
];

test("purchase totals preserve recorded prices, estimates and missing coverage", () => {
  assert.deepEqual(summarizePurchaseCosts(rows, catalog), { cost: 6150000, covered: 2, estimated: 1, total: 3 });
  assert.deepEqual(summarizePurchaseCosts(rows.slice(1, 2), catalog), { cost: 3750000, covered: 1, estimated: 1, total: 1 });
  assert.deepEqual(summarizePurchaseCosts(rows.slice(2), catalog), { cost: null, covered: 0, estimated: 0, total: 1 });
  assert.deepEqual(summarizePurchaseCosts([], catalog), { cost: 0, covered: 0, estimated: 0, total: 0 });
});
