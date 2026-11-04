import assert from "node:assert/strict";
import { test } from "node:test";
import { prepare, row } from "./fixtures";
import { buildManagementDirectory } from "../../management/lib/build-management-directory";
import { derivePlotState, legacyPlotRouteId } from "../../management/lib/plot-state";

test("legacy plot route identifiers are deterministic, namespaced and do not expose plot codes", () => {
  const id = legacyPlotRouteId("72a1/j54");
  assert.equal(id, legacyPlotRouteId("72A1/J54"));
  assert.notEqual(id, legacyPlotRouteId("72C/J54"));
  assert.match(id, /^legacy_[A-Za-z0-9_-]{43}$/);
  assert.equal(id.includes("72A1"), false);
});

test("plot state orders dated events, ignores undated and duplicate rows, and confirms completion only when latest", () => {
  const source = [
    row({ plotCode: "A", date: "08/10/2026", workStatus: "Garap Petak Selesai" }),
    row({ plotCode: "A", date: "04/10/2026", workStatus: "Mulai Garap Petak" }),
    row({ plotCode: "A", date: "05/10/2026", workStatus: "Garap Petak Berlangsung" }),
    row({ plotCode: "A", date: "", workStatus: "Garap Petak Selesai" }),
    row({ plotCode: "A", date: "08/10/2026", workStatus: "Garap Petak Selesai" }),
  ];
  const normalized = prepare(source);
  const state = derivePlotState(normalized.records);

  assert.equal(state.status, "Selesai");
  assert.equal(state.startDate, "2026-10-04");
  assert.equal(state.latestActivityDate, "2026-10-08");
  assert.equal(state.completionDate, "2026-10-08");
  assert.equal(state.startEventCount, 1);
});

test("ambiguous same-day statuses do not claim a completion date", () => {
  const normalized = prepare([
    row({ plotCode: "A", date: "08/10/2026", workStatus: "Garap Petak Selesai" }),
    row({ plotCode: "A", date: "08/10/2026", workStatus: "Garap Petak Berlangsung" }),
  ]);

  const state = derivePlotState(normalized.records);
  assert.equal(state.statusAmbiguous, true);
  assert.equal(state.status, null);
  assert.equal(state.completionDate, null);
});

test("plot detail separates refill entries from activity history and flags repeated campaigns", () => {
  const result = buildManagementDirectory([
    row({ plotCode: "A", plotArea: 2, date: "01/10/2026", hmStart: 10, hmEnd: 12, workingHours: 2, actualFuelUsage: 20, fuelRefill: 50, workStatus: "Mulai Garap Petak" }),
    row({ plotCode: "A", plotArea: "", date: "02/10/2026", hmStart: 12, hmEnd: 14, workingHours: 2, actualFuelUsage: 15, fuelRefill: "", workStatus: "Garap Petak Berlangsung" }),
    row({ plotCode: "A", plotArea: "", date: "03/10/2026", hmStart: 14, hmEnd: 15, workingHours: 1, actualFuelUsage: 8, fuelRefill: 0, workStatus: "Mulai Garap Petak" }),
  ]);
  const plot = result.plots[0];

  assert.equal(plot.activities.length, 3);
  assert.equal(plot.fuelRefills.length, 2);
  assert.deepEqual(plot.fuelRefills.map(({ liters }) => liters), [50, 0]);
  assert.equal(plot.hours, 5);
  assert.equal(plot.fuel, 43);
  assert.equal(plot.startEventCount, 2);
  assert.equal(plot.campaignRequiresReview, true);
});

test("completion is not inferred from a later activity date without a completion event", () => {
  const state = derivePlotState(prepare([
    row({ plotCode: "A", date: "01/10/2026", workStatus: "Mulai Garap Petak" }),
    row({ plotCode: "A", date: "30/10/2026", workStatus: "Garap Petak Berlangsung" }),
  ]).records);
  assert.equal(state.status, "Dalam pengerjaan");
  assert.equal(state.completionDate, null);
});
