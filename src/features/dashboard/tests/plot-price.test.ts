import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePlotPrice, parsePlotPrices } from "../../management/lib/plot-price";
import { calculateTwoPercentTax } from "../../shared/tax";

const header = ["No", "No. SPK", "Kode Petak", "Harga Per Hektar", "Keterangan"];
const plot = { code: "72A1/J54", spks: ["5123120254"], area: 8.6, areaRequiresReview: false };

test("tax is calculated from gross value and preserves missing values", () => {
  assert.deepEqual(calculateTwoPercentTax(1000), { tax: 20, afterTax: 980 });
  assert.deepEqual(calculateTwoPercentTax(0), { tax: 0, afterTax: 0 });
  assert.equal(calculateTwoPercentTax(null), null);
  assert.equal(calculateTwoPercentTax(Infinity), null);
});

test("plot value uses the matching plot and SPK price and verified area", () => {
  const prices = parsePlotPrices([header, [1, "5123120254", "72A1/J54", 4180900], [2, "5123120254", "OTHER", 5]]);
  assert.deepEqual(calculatePlotPrice(prices, plot), { amount: 35955740, tax: 719114.8, afterTax: 35236625.2, pricePerHa: 4180900, area: 8.6 });
});

test("missing or ambiguous price, SPK and area do not produce a value", () => {
  const row = [1, "5123120254", "72A1/J54", 4180900];
  const prices = parsePlotPrices([header, row]);
  assert.equal(calculatePlotPrice(null, plot), null);
  assert.equal(calculatePlotPrice(prices, { ...plot, spks: [] }), null);
  assert.equal(calculatePlotPrice(prices, { ...plot, spks: ["5123120254", "OTHER"] }), null);
  assert.equal(calculatePlotPrice(prices, { ...plot, area: 0 }), null);
  assert.equal(calculatePlotPrice(prices, { ...plot, areaRequiresReview: true }), null);
  assert.equal(calculatePlotPrice(parsePlotPrices([header, row, row]), plot), null);
  assert.equal(calculatePlotPrice(parsePlotPrices([header, [1, "5123120254", "72A1/J54", -1]]), plot), null);
  assert.equal(calculatePlotPrice(parsePlotPrices([header, row, [2, "", "72A1/J54", 5]]), plot), null);
  assert.throws(() => parsePlotPrices([["invalid"]]));
});
