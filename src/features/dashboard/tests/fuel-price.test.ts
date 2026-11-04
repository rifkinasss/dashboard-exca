import assert from "node:assert/strict";
import { test } from "node:test";
import { FUEL_PRICE_RANGE, fuelPriceForDate, parseFuelPriceCatalog, resolveWithdrawalPricing } from "../lib/fuel-price";

const header = ["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"];
const master = [header, [1, 46300, 24500, true], [2, 46331, 27500, true], [3, "", "", false]];

test("approved prices apply from their effective dates without changing earlier history", () => {
  const catalog = parseFuelPriceCatalog(master);
  assert.equal(FUEL_PRICE_RANGE, "'Pengambilan Solar'!H4:L");
  assert.deepEqual(catalog.issues, []);
  assert.equal(fuelPriceForDate(catalog, "2026-11-04")?.rupiahPerLiter, 24500);
  assert.equal(fuelPriceForDate(catalog, "2026-11-05")?.rupiahPerLiter, 27500);
  assert.equal(fuelPriceForDate(catalog, "2026-10-04"), null);
});

test("inactive prices retain prior price; invalid or duplicate dates fail closed", () => {
  const unchanged = parseFuelPriceCatalog([header, [1, 46300, 24500, true], [2, 46331, 27500, false]]);
  assert.equal(fuelPriceForDate(unchanged, "2026-11-10")?.rupiahPerLiter, 24500);
  for (const rows of [[header, [1, 46300, 24500, true], [2, 46300, 27500, false]], [header, [1, 46300, 24500, "TRUE"]], [header, [1, 46300, 0, true]]]) {
    const result = parseFuelPriceCatalog(rows);
    assert.ok(result.issues.length);
    assert.equal(fuelPriceForDate(result, "2026-11-10"), null);
  }
});


test("recorded transaction snapshots remain unchanged when master prices change", () => {
  const source = { date: "2026-11-06", liters: 100, price: 24500, cost: 2450000, priceInvalid: false };
  const catalog = parseFuelPriceCatalog(master);
  assert.deepEqual(resolveWithdrawalPricing(source, catalog), { kind: "recorded", price: 24500, cost: 2450000 });
  assert.deepEqual(resolveWithdrawalPricing({ ...source, price: null, cost: null }, catalog), { kind: "estimated", price: 27500, cost: 2750000 });
  assert.equal(resolveWithdrawalPricing({ ...source, priceInvalid: true }, catalog).kind, "review");
});


test("price validation reports actual source row numbers", () => {
  const result = parseFuelPriceCatalog([header, [1, 46300, 24500, "TRUE"]]);
  assert.match(result.issues[0], /baris 5/);
});
