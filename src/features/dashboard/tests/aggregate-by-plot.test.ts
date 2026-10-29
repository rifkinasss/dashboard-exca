import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateByPlot } from "../lib/aggregate-by-plot";
import { aggregateDailyTrend } from "../lib/aggregate-daily-trend";
import { deriveWorkStatus } from "../lib/derive-work-status";
import { normalizeOverview } from "../lib/normalize-overview";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { fixture, prepare, row } from "./fixtures";

test("plot aggregates reuse KPI calculations and never sum repeated area or cumulative fields", () => {
  const plots = aggregateByPlot(prepare(fixture).records);
  assert.equal(plots.length, 2);
  assert.deepEqual(plots.map((plot) => [plot.code, plot.area, plot.fuel, plot.hours, plot.efficiency]), [
    ["PTK-01", 4.8, 190, 13, 190 / 13], ["PTK-02", 6.2, 0, 9, 0],
  ]);
  assert.equal(buildDashboardViewModel(fixture).summary.totals.area, 11);
});

test("daily fuel totals expose independent per-plot series including missing and zero", () => {
  assert.deepEqual(aggregateDailyTrend(prepare(fixture).records), [
    { date: "2026-10-01", fuel: 100, byPlot: { "PTK-01": 100, "PTK-02": null } },
    { date: "2026-10-02", fuel: 90, byPlot: { "PTK-01": 90, "PTK-02": 0 } },
  ]);
});

test("latest known status ignores missing/invalid dates and uses physical row only when confirmed", () => {
  const records = normalizeOverview([
    row({ no: 999, workStatus: "Ditunda" }),
    row({ no: 1, workStatus: "Selesai" }),
    row({ date: "03/10/2026", workStatus: "" }),
    row({ date: "invalid", workStatus: "Belum mulai" }),
  ]).records;
  assert.deepEqual(deriveWorkStatus(records), { status: null, ambiguous: true });
  assert.deepEqual(deriveWorkStatus(records, true), { status: "Selesai", ambiguous: false });
  assert.deepEqual(deriveWorkStatus(records.toReversed(), true), deriveWorkStatus(records, true));
  assert.deepEqual(deriveWorkStatus([...records, normalizeOverview([row({ date: "04/10/2026", workStatus: "Dalam pengerjaan" })], { firstDataRow: 10 }).records[0]]), { status: "Dalam pengerjaan", ambiguous: false });
  assert.deepEqual(deriveWorkStatus(normalizeOverview([row({ workStatus: "" })]).records), { status: null, ambiguous: false });
});

test("a plot with only missing area has no fabricated zero; inconsistent area requires review", () => {
  const missing = aggregateByPlot(prepare([row({ plotArea: "" })]).records)[0];
  assert.equal(missing.area, null);
  const inconsistent = aggregateByPlot(prepare([row(), row({ plotArea: 5 })]).records)[0];
  assert.equal(inconsistent.area, null);
  assert.equal(inconsistent.areaRequiresReview, true);
  const view = buildDashboardViewModel([row(), row({ plotCode: "PTK-02", plotArea: "" })]);
  assert.equal(view.summary.totals.area, null);
});
