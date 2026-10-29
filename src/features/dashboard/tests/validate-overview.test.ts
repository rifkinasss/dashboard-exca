import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOverview } from "../lib/normalize-overview";
import { validateOverview } from "../lib/validate-overview";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { prepare, row } from "./fixtures";

test("negative domain values are preserved and excluded only from related metrics", () => {
  const raw = row({ plotArea: -4, fuelRefill: -25, actualFuelUsage: -12, workingHours: -2, hmStart: "", hmEnd: "" });
  const result = prepare([raw]);
  assert.deepEqual(result.issues.filter((issue) => issue.code === "negative_value").map((issue) => issue.field).sort(), ["actualFuelUsage", "fuelRefill", "plotArea", "workingHours"]);
  assert.equal(result.records[0].record.fuelRefill, -25);
  assert.equal(result.records[0].record.raw[9], -25);
  assert.equal(result.records[0].efficiencyEligible, false);
  const totals = buildDashboardViewModel([row({ fuelRefill: -5 })]).summary.totals;
  assert.equal(totals.refill, null);
  assert.equal(totals.fuel, 100);
  assert.equal(totals.hours, 10);
});

test("reversed and inconsistent meters exclude H and efficiency, not fuel", () => {
  for (const overrides of [{ hmEnd: 90 }, { workingHours: 9.9 }]) {
    const input = [row(overrides)];
    const result = prepare(input);
    assert.ok(result.records[0].invalidFields.includes("workingHours"));
    assert.equal(result.records[0].efficiencyEligible, false);
    const totals = buildDashboardViewModel(input).summary.totals;
    assert.equal(totals.fuel, 100);
    assert.equal(totals.refill, 120);
    assert.equal(totals.hours, null);
    assert.equal(totals.efficiency, null);
  }
  assert.equal(prepare([row({ hmStart: "100,1", hmEnd: "100,3", workingHours: "0,2" })]).records[0].efficiencyEligible, true);
});

test("conflicting areas are flagged across the source, even in a narrower date view", () => {
  const input = [row(), row({ date: "02/10/2026", plotArea: "5,0" })];
  const result = prepare(input);
  assert.equal(result.issues.filter((issue) => issue.code === "area_conflict").length, 2);
  const view = buildDashboardViewModel(input, { startDate: "2026-10-01", endDate: "2026-10-01", plotCodes: [], statuses: [] });
  assert.equal(view.summary.plots[0].area, null);
  assert.equal(view.summary.plots[0].areaRequiresReview, true);
  assert.equal(view.summary.totals.area, null);
  assert.equal(view.summary.totals.fuel, 100);
});

test("same-date conflicting statuses are ambiguous until source order is confirmed", () => {
  const input = [row({ no: 999 }), row({ no: 1, workStatus: "Selesai" })];
  const view = buildDashboardViewModel(input);
  assert.equal(view.summary.plots[0].status, null);
  assert.equal(view.summary.plots[0].statusAmbiguous, true);
  assert.deepEqual(view.summary.statuses, [{ status: "Perlu tinjau", count: 1 }]);
  assert.ok(view.issues.some((issue) => issue.code === "status_conflict" && issue.severity === "warning"));
  const confirmed = buildDashboardViewModel(input, undefined, { sheetOrderConfirmed: true });
  assert.equal(confirmed.summary.plots[0].status, "Selesai");
  assert.ok(confirmed.issues.some((issue) => issue.code === "status_conflict" && issue.severity === "info"));
});

test("exact duplicates are traceable; repeated No alone never identifies a duplicate", () => {
  const view = buildDashboardViewModel([row(), row(), row({ date: "02/10/2026" })]);
  assert.equal(view.filteredRecords.length, 2);
  assert.equal(view.summary.totals.fuel, 200);
  assert.equal(view.excludedRows, 1);
  const issue = view.issues.find((issue) => issue.code === "duplicate_record");
  assert.equal(issue?.source.row, 3);
  assert.deepEqual(issue?.relatedRows, [2]);
  const invalid = prepare([row({ actualFuelUsage: NaN }), row({ actualFuelUsage: Infinity })]);
  assert.equal(invalid.records.filter((item) => item.duplicateOf !== null).length, 0);
});

test("missing pairs warn, unknown unrelated fields do not discard the activity", () => {
  const result = prepare([row({ actualFuelUsage: "", totalFuelConsumption: "bad", fuelPerHour: "bad" })]);
  assert.ok(result.issues.some((issue) => issue.code === "unpaired_measurements" && issue.severity === "warning"));
  assert.ok(result.issues.some((issue) => issue.code === "missing_value" && issue.severity === "info"));
  assert.ok(prepare([row({ actualFuelUsage: "", workingHours: "" })]).issues.some((issue) => issue.code === "unpaired_measurements" && issue.severity === "info"));
  const view = buildDashboardViewModel([row({ fuelPerHour: "bad", totalFuelConsumption: "bad", remainingFuel: "bad" })]);
  assert.equal(view.filteredRecords.length, 1);
  assert.equal(view.summary.totals.efficiency, 10);
});

test("validation leaves normalized records and raw input untouched", () => {
  const record = normalizeOverview([row({ workingHours: 9 })]).records[0];
  const before = structuredClone(record);
  Object.freeze(record.raw);
  Object.freeze(record.cellStates);
  Object.freeze(record);
  validateOverview(Object.freeze([record]));
  assert.deepEqual(record, before);
});
