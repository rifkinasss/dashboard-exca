import assert from "node:assert/strict";
import { test } from "node:test";
import { formatFuelPriceInput, planFuelPriceActivation, planFuelPriceInsert, validateFuelPriceInput } from "../lib/fuel-price-input";

test("formats rupiah input while preserving decimals and caret position", () => {
  assert.deepEqual(formatFuelPriceInput("24500", 5), { value: "24.500", caret: 6 });
  assert.deepEqual(formatFuelPriceInput("24.500,75", 9), { value: "24.500,75", caret: 9 });
  assert.deepEqual(formatFuelPriceInput("124.500", 1), { value: "124.500", caret: 1 });
  assert.deepEqual(formatFuelPriceInput("24500,", 6), { value: "24.500,", caret: 7 });
  const result = validateFuelPriceInput({ date: "2026-12-05", price: formatFuelPriceInput("24500", 5).value, active: true, note: "" });
  assert.equal(result.ok && result.value.price, 24500);
});

const h = ["No", "Tanggal Berlaku", "Harga Solar per Liter", "Status", "Keterangan"];
const input = validateFuelPriceInput({ date: "2026-12-05", price: "28.000", active: false, note: "Harga baru" });

test("prepares a price without activating earlier or future prices", () => {
  assert.ok(input.ok);
  const plan = planFuelPriceInsert([h, [1, 46300, 24500, true], [2, 46331, 27500, false], [3, "", "", false], [4, "", "", false]], input.value);
  assert.deepEqual(plan, { ok: true, row: 7, number: 3, rowValues: [3, 46361, 28000, false, "Harga baru"] });
});

test("rejects duplicate dates, invalid prices and unsafe numbering", () => {
  assert.ok(input.ok);
  assert.equal(planFuelPriceInsert([h, [1, input.value.serial, 28000, false]], input.value).ok, false);
  assert.equal(planFuelPriceInsert([h, [1, 46300, 24500, true], [1]], input.value).ok, false);
  assert.equal(validateFuelPriceInput({ date: "2026-02-30", price: "0", active: true, note: "" }).ok, false);
});


test("activates only the exact existing inactive row", () => {
  const values = [h, [1, 46300, 24500, true], [2, 46331, 27500, false]];
  assert.deepEqual(planFuelPriceActivation(values, 6, "2026-11-05", 27500), { ok: true, row: 6 });
  assert.equal(planFuelPriceActivation(values, 6, "2026-11-05", 28000).ok, false);
  assert.equal(planFuelPriceActivation(values, 5, "2026-10-05", 24500).ok, false);
});
