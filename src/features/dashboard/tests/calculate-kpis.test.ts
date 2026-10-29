import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateKpis } from "../lib/calculate-kpis";
import { fixture, prepare, row } from "./fixtures";

test("J, L and H totals and paired weighted rate match manually verified values", () => {
  const totals = calculateKpis(prepare(fixture).records);
  assert.equal(totals.refill, 170);
  assert.equal(totals.fuel, 190);
  assert.equal(totals.hours, 22);
  assert.equal(totals.efficiency, 190 / 15);
  assert.notEqual(totals.efficiency, (10 + 30 + 0) / 3);
});

test("division by zero, real zero, and wholly missing measurements differ", () => {
  const zero = calculateKpis(prepare([row({ actualFuelUsage: 0, workingHours: 0, fuelRefill: 0, hmStart: 100, hmEnd: 100 })]).records);
  assert.deepEqual(zero, { refill: 0, fuel: 0, hours: 0, efficiency: null });
  assert.equal(calculateKpis(prepare([row({ actualFuelUsage: 0 })]).records).efficiency, 0);
  assert.deepEqual(calculateKpis(prepare([row({ fuelRefill: "", actualFuelUsage: "", workingHours: "" })]).records), { refill: null, fuel: null, hours: null, efficiency: null });
  assert.equal(calculateKpis(prepare([row({ actualFuelUsage: 100, workingHours: 0, hmEnd: 100 })]).records).efficiency, null);
  assert.equal(calculateKpis([]).fuel, null);
});

test("missing one half of a pair does not dilute the rate or remove an independent total", () => {
  const totals = calculateKpis(prepare([
    row(), row({ date: "02/10/2026", actualFuelUsage: "", workingHours: 20, hmEnd: 120 }),
    row({ date: "03/10/2026", actualFuelUsage: 90, workingHours: "", hmEnd: "" }),
  ]).records);
  assert.equal(totals.fuel, 190);
  assert.equal(totals.hours, 30);
  assert.equal(totals.efficiency, 10);
});

test("non-finite parsed values and arithmetic overflow cannot escape as NaN or Infinity", () => {
  const invalid = calculateKpis(prepare([row({ actualFuelUsage: Infinity, workingHours: NaN, fuelRefill: -Infinity })]).records);
  assert.deepEqual(invalid, { fuel: null, hours: null, refill: null, efficiency: null });
  const overflow = calculateKpis(prepare([row({ actualFuelUsage: 1e308 }), row({ date: "02/10/2026", actualFuelUsage: 1e308 })]).records);
  assert.equal(overflow.fuel, null);
  const tiny = calculateKpis(prepare([row({ actualFuelUsage: 1e308, workingHours: 1e-308, hmStart: "", hmEnd: "" })]).records);
  assert.equal(tiny.efficiency, null);
});
