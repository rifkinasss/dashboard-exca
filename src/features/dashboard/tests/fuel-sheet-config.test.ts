import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fuelSheetConfig, fuelWriteTargetsAllowed, plotPriceSheet, sheetRange } from "../lib/fuel-sheet-config";

test("harga petak memakai worksheet testing secara eksplisit dalam mode testing", () => {
  assert.equal(plotPriceSheet({}), "Master Harga Petak");
  assert.equal(plotPriceSheet({ FUEL_TESTING_ONLY: "true", PLOT_PRICE_SHEET_NAME: "Master Harga Petak - testing" }), "Master Harga Petak - testing");
  assert.throws(() => plotPriceSheet({ FUEL_TESTING_ONLY: "true" }));
  assert.throws(() => plotPriceSheet({ FUEL_TESTING_ONLY: "true", PLOT_PRICE_SHEET_NAME: "Master Harga Petak" }));
});

test("sumber dan penulis menggunakan pasangan worksheet uji secara eksplisit", () => {
  assert.deepEqual(fuelSheetConfig({}), { withdrawal: "Pengambilan Solar", price: "Pengambilan Solar", testing: false });
  assert.deepEqual(fuelSheetConfig({ FUEL_WITHDRAWAL_SHEET_NAME: "Okt_2026 testing", FUEL_PRICE_SHEET_NAME: "master harga_testing" }), { withdrawal: "Okt_2026 testing", price: "master harga_testing", testing: true });
  assert.throws(() => fuelSheetConfig({ FUEL_WITHDRAWAL_SHEET_NAME: "Okt_2026 testing" }));
  assert.equal(sheetRange("Harga O'Brien", "H4:L"), "'Harga O''Brien'!H4:L");
});

test("mode testing menolak penulisan jika salah satu worksheet bukan worksheet uji", () => {
  const env = { FUEL_TESTING_ONLY: "true", FUEL_WITHDRAWAL_SHEET_NAME: "Pengambilan Solar testing", FUEL_PRICE_SHEET_NAME: "master harga_testing" };
  assert.equal(fuelWriteTargetsAllowed(env), false);
  assert.equal(fuelWriteTargetsAllowed({}), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_TESTING_ONLY: "false" }), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_WITHDRAWAL_SHEET_NAME: "Pengambilan Solar" }), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_PRICE_SHEET_NAME: "" }), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_PRICE_SHEET_NAME: "testing produksi" }), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_WITHDRAWAL_SHEET_NAME: "Pengambilan Solar - testing", FUEL_PRICE_SHEET_NAME: "Pengambilan Solar - testing" }), true);
});

test("penulisan resmi membutuhkan dua nama worksheet resmi dan mode testing nonaktif", () => {
  const env = { FUEL_TESTING_ONLY: "false", FUEL_WITHDRAWAL_SHEET_NAME: "Pengambilan Solar", FUEL_PRICE_SHEET_NAME: "Pengambilan Solar", PLOT_PRICE_SHEET_NAME: "Master Harga Petak" };
  assert.deepEqual(fuelSheetConfig(env), { withdrawal: "Pengambilan Solar", price: "Pengambilan Solar", testing: false });
  assert.equal(plotPriceSheet(env), "Master Harga Petak");
  assert.equal(fuelWriteTargetsAllowed(env), true);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_TESTING_ONLY: "true" }), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_TESTING_ONLY: undefined }), false);
  assert.equal(fuelWriteTargetsAllowed({ ...env, FUEL_PRICE_SHEET_NAME: "Pengambilan Solar - testing" }), false);
});
