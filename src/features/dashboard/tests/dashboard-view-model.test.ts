import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { defaultFilters } from "../lib/overview";
import { mockOverview } from "../data/mock-overview";
import { formatDate } from "../lib/format";
import { fixture, row } from "./fixtures";

const filter = (changes: Partial<typeof defaultFilters>) => ({ ...defaultFilters, ...changes });

test("date filtering is inclusive, supports open bounds and rejects invalid/reversed ranges", () => {
  const view = buildDashboardViewModel(fixture, filter({ startDate: "2026-10-02", endDate: "2026-10-02" }));
  assert.equal(view.filteredRecords.length, 2);
  assert.equal(view.summary.totals.fuel, 90);
  assert.equal(buildDashboardViewModel(fixture, filter({ startDate: "", endDate: "" })).filteredRecords.length, 4);
  for (const dates of [{ startDate: "2026-10-03", endDate: "2026-10-01" }, { startDate: "2026-02-30" }, { endDate: "invalid" }]) {
    assert.equal(buildDashboardViewModel(fixture, filter(dates)).filteredRecords.length, 0);
  }
});

test("plot/status multiselect filters use OR within groups and AND across groups", () => {
  const plot = buildDashboardViewModel(fixture, filter({ plotCodes: ["PTK-01"] }));
  assert.equal(plot.summary.totals.plotCount, 1);
  assert.equal(plot.summary.totals.hours, 13);
  const done = buildDashboardViewModel(fixture, filter({ statuses: ["Selesai"] }));
  assert.equal(done.filteredRecords.length, 2);
  assert.equal(done.summary.totals.fuel, 190);
  const combined = buildDashboardViewModel(fixture, filter({ plotCodes: ["PTK-02"], statuses: ["Selesai", "Ditunda"] }));
  assert.equal(combined.filteredRecords.length, 2);
  assert.deepEqual(combined.summary.statuses, [{ status: "Ditunda", count: 1 }]);
  assert.equal(buildDashboardViewModel(fixture, filter({ plotCodes: ["PTK-01"], statuses: ["Ditunda"] })).filteredRecords.length, 0);
  assert.equal(buildDashboardViewModel(fixture, filter({ endDate: "2026-10-01", statuses: ["Selesai"] })).filteredRecords.length, 0);
});

test("ambiguous status does not match a known-status filter; confirmed order resolves consistently", () => {
  const raw = [row(), row({ workStatus: "Selesai" })];
  const filters = filter({ statuses: ["Selesai"] });
  assert.equal(buildDashboardViewModel(raw, filters).filteredRecords.length, 0);
  const resolved = buildDashboardViewModel(raw, filters, { sheetOrderConfirmed: true });
  assert.equal(resolved.filteredRecords.length, 2);
  assert.deepEqual(resolved.summary.statuses, [{ status: "Selesai", count: 1 }]);
});

test("invalid identity/date excludes the row from the shared view, unrelated invalid cells do not", () => {
  const view = buildDashboardViewModel([row({ date: "invalid" }), row({ plotCode: "" }), row({ no: "invalid", estimatedWorkingHours: "bad" })]);
  assert.equal(view.filteredRecords.length, 1);
  assert.equal(view.excludedRows, 2);
  assert.equal(view.summary.totals.fuel, 100);
  assert.ok(view.issues.some((issue) => issue.field === "date" && issue.severity === "error"));
  assert.ok(view.issues.some((issue) => issue.field === "plotCode" && issue.severity === "error"));
});

test("KPI, chart, daily/per-plot, and status outputs reconcile from the same filtered set", () => {
  for (const filters of [defaultFilters, filter({ plotCodes: ["PTK-01"] }), filter({ statuses: ["Ditunda"] }), filter({ startDate: "2026-10-02" })]) {
    const { summary } = buildDashboardViewModel(fixture, filters);
    assert.equal(summary.totals.fuel, summary.plots.reduce((sum, plot) => sum + (plot.fuel ?? 0), 0));
    assert.equal(summary.totals.fuel, summary.daily.reduce((sum, day) => sum + (day.fuel ?? 0), 0));
    assert.equal(summary.totals.hours, summary.plots.reduce((sum, plot) => sum + (plot.hours ?? 0), 0));
    assert.equal(summary.totals.plotCount, summary.statuses.reduce((sum, item) => sum + item.count, 0));
    for (const day of summary.daily) {
      const measured = Object.values(day.byPlot).filter((value): value is number => value !== null);
      assert.equal(day.fuel, measured.length ? measured.reduce((sum, value) => sum + value, 0) : null);
    }
  }
});

test("empty view and entirely unmeasured view do not manufacture zero measurements", () => {
  const empty = buildDashboardViewModel([], defaultFilters).summary;
  assert.deepEqual(empty.totals, { plotCount: 0, area: null, refill: null, fuel: null, hours: null, efficiency: null });
  assert.deepEqual(empty.plots, []);
  assert.deepEqual(empty.daily, []);
  const missing = buildDashboardViewModel([row({ actualFuelUsage: "" })]).summary;
  assert.equal(missing.totals.fuel, null);
  assert.equal(missing.plots[0].fuel, null);
  assert.equal(missing.daily[0].fuel, null);
  assert.equal(missing.daily[0].byPlot["PTK-01"], null);
});

test("synthetic Phase 1 fixture stays functional with unchanged manually checked totals", () => {
  const view = buildDashboardViewModel(mockOverview);
  assert.equal(view.records.length, 64);
  assert.equal(view.summary.totals.plotCount, 8);
  assert.equal(view.summary.totals.area, 40.9);
  assert.equal(view.summary.totals.refill, 7000);
  assert.equal(view.summary.totals.fuel, 5759);
  assert.equal(view.summary.totals.hours, 367.5);
  assert.equal(view.summary.totals.efficiency, 5759 / 362);
  assert.equal(view.summary.missingMeasurements, 1);
  assert.deepEqual(view.summary.statuses.map((item) => item.count), [1, 4, 2, 1]);
  assert.equal(view.issues.filter((issue) => issue.severity === "error").length, 0);
});

test("raw inputs are not mutated and normalized raw snapshots are independent", () => {
  const input = fixture.map((row) => Object.freeze([...row]));
  const before = structuredClone(input);
  buildDashboardViewModel(Object.freeze(input));
  assert.deepEqual(input, before);
  const mutable = [...row()];
  const view = buildDashboardViewModel([mutable]);
  mutable[12] = 99999;
  assert.equal(view.records[0].raw[12], 100);
});

test("timezone display preserves date-only calendar values in Asia/Makassar", () => {
  assert.equal(formatDate("2026-10-01", { day: "2-digit", month: "2-digit", year: "numeric" }), "01/10/2026");
});

test("every chart-facing number remains finite for invalid input and arithmetic overflow", () => {
  const { summary } = buildDashboardViewModel([
    row({ actualFuelUsage: NaN, fuelRefill: Infinity, workingHours: -Infinity }),
    row({ plotCode: "PTK-02", actualFuelUsage: 1e308, fuelRefill: 1e308, plotArea: 1e308, workingHours: 1e-308, hmStart: "", hmEnd: "" }),
    row({ plotCode: "PTK-03", actualFuelUsage: 1e308, fuelRefill: 1e308, plotArea: 1e308, workingHours: 1e-308, hmStart: "", hmEnd: "" }),
  ]);
  function check(value: unknown) {
    if (typeof value === "number") assert.ok(Number.isFinite(value));
    else if (value !== null && typeof value === "object") Object.values(value).forEach(check);
  }
  check(summary);
  assert.equal(summary.totals.fuel, null);
  assert.equal(summary.totals.area, null);
  assert.equal(summary.plots[1].efficiency, null);
});
