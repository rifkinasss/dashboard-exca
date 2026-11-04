import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFinanceDraft, type FinanceDraftPlot } from "../../finance/lib/automatic-finance-draft";
import { parsePlotPrices } from "../../management/lib/plot-price";
import { parseFuelWithdrawals } from "../lib/fuel-withdrawals";
import { parseFuelPriceCatalog } from "../lib/fuel-price";

const plot: FinanceDraftPlot = { code: "A", spks: ["S1"], area: 2, areaRequiresReview: false, campaignRequiresReview: false };
const prices = parsePlotPrices([["No", "No. SPK", "Kode Petak", "Harga Per Hektar", "Keterangan"], [1, "S1", "A", 1000]]);
const purchases = parseFuelWithdrawals([["No", "Tanggal Ambil", "Solar", "No Petak"], [1, 46305, 10, "A", 10, 100], [2, 46305, 20, "A"], [3, 46305, 100, "B"]]);
const catalog = parseFuelPriceCatalog([["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"], [1, 46300, 10, true, ""]]);

test("draft calculates plot value and sums only matching purchases with estimated cost identified", () => {
  const result = calculateFinanceDraft(plot, prices, purchases, catalog);
  assert.equal(result.plotPrice?.amount, 2000);
  assert.equal(result.plotPrice?.afterTax, 1960);
  assert.equal(result.purchaseCost, 300);
  assert.equal(result.purchaseCount, 2);
  assert.equal(result.estimatedCount, 1);
  assert.equal(result.incompletePurchases, false);
});

test("draft leaves ambiguous plot values unavailable and reports incomplete purchase pricing", () => {
  assert.equal(calculateFinanceDraft({ ...plot, spks: [] }, prices, purchases, catalog).plotPrice, null);
  assert.equal(calculateFinanceDraft({ ...plot, spks: ["S1", "S2"] }, prices, purchases, catalog).plotPrice, null);
  assert.equal(calculateFinanceDraft({ ...plot, campaignRequiresReview: true }, prices, purchases, catalog).plotPrice, null);
  assert.equal(calculateFinanceDraft({ ...plot, areaRequiresReview: true }, prices, purchases, catalog).plotPrice, null);
  const partial = calculateFinanceDraft(plot, prices, purchases, null);
  assert.equal(partial.purchaseCost, 100);
  assert.equal(partial.incompletePurchases, true);
  assert.equal(calculateFinanceDraft(plot, prices, null, null).purchaseCost, null);
});
