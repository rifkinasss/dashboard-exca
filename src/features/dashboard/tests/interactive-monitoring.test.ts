import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { filterQuality, monitoringTrend, plotDetails, readFilters, writeFilters } from "../lib/interactive-monitoring";
import { row } from "./fixtures";

const all = { startDate: "", endDate: "", plotCodes: [] as string[], selectedSpkNumbers: [] as string[], statuses: [] };
const rows = [
  row({ no: 1, plotCode: "A/1", date: "01/10/2026", workStatus: "Mulai Garap Petak" }),
  row({ no: 2, plotCode: "A/1", date: "03/10/2026", workStatus: "Garap Petak Berlangsung", actualFuelUsage: 0, workingHours: 0, hmStart: 0, hmEnd: 0 }),
  row({ no: 3, plotCode: "A/1", date: "03/11/2026", workStatus: "Garap Petak Selesai", actualFuelUsage: "" }),
  row({ no: 4, plotCode: "B", date: "03/10/2026", workStatus: "Tidak dikenal" }),
  row({ no: 5, plotCode: "C", date: "", actualFuelUsage: 900 }),
];

test("filter URLs round trip combined selections and preserve unrelated parameters", () => {
  const filters = { startDate: "2026-10-01", endDate: "2026-10-03", plotCodes: ["A/1", "B"], selectedSpkNumbers: [], statuses: ["Dalam pengerjaan" as const] };
  const query = writeFilters("?other=kept&plot=old", filters);
  assert.equal(new URLSearchParams(query).get("other"), "kept");
  assert.deepEqual(readFilters(query, all), filters);
  assert.equal(readFilters("?start=2026-02-30&status=unknown", all).startDate, "");
  assert.deepEqual(readFilters("?status=unknown", all).statuses, []);
  const view = buildDashboardViewModel(rows, filters);
  assert.equal(view.filteredRecords.length, 2);
  assert.equal(view.summary.totals.fuel, 100);
  assert.equal(view.inventory.length, 3);
});

test("daily and ISO weekly monitoring preserves gaps, zero, units and boundaries", () => {
  const view = buildDashboardViewModel(rows, { ...all, endDate: "2026-10-03", plotCodes: ["A/1"] });
  const daily = monitoringTrend(view.filteredValidatedRecords, "daily");
  assert.deepEqual(daily.map((d) => [d.date, d.fuel, d.hours]), [["2026-10-01", 100, 10], ["2026-10-02", null, null], ["2026-10-03", 0, 0]]);
  const weekly = monitoringTrend(view.filteredValidatedRecords, "weekly");
  assert.deepEqual(weekly.map((d) => [d.date, d.endDate, d.fuel, d.hours, d.plots]), [["2026-09-28", "2026-10-04", 100, 10, "A/1"]]);
  assert.deepEqual(monitoringTrend([], "daily"), []);
});

test("detail and comparison retain historical scope and suppress incomplete efficiency", () => {
  const early = buildDashboardViewModel(rows, { ...all, endDate: "2026-10-03" });
  const plot = early.inventory.find((p) => p.code === "A/1")!;
  const detail = plotDetails("A/1", early.validatedRecords, early.filteredValidatedRecords);
  assert.equal(plot.status, "Dalam pengerjaan");
  assert.equal(detail.latest.status, "Selesai");
  assert.equal(detail.firstDate, "2026-10-01");
  assert.equal(detail.lastDate, "2026-11-03");
  assert.equal(detail.activity.length, 2);
  assert.equal(detail.comparableEfficiency, 10);
  assert.equal(detail.activity[0].record.source.row, 2);
  const full = buildDashboardViewModel(rows, all);
  assert.equal(plotDetails("A/1", full.validatedRecords, full.filteredValidatedRecords).comparableEfficiency, null);
  assert.equal(full.summary.totals.fuel, 200);
  assert.equal(full.inventory.find((p) => p.code === "B")?.status, null);
  assert.equal(full.inventory.find((p) => p.code === "C")?.hasActivity, false);
});

test("quality filters combine severity, plot, row and type without altering issues", () => {
  const view = buildDashboardViewModel(rows, all);
  const issue = view.issues.find((i) => i.source.row === 4 && i.field === "actualFuelUsage")!;
  assert.ok(issue);
  const found = filterQuality(view.issues, view.records, { severity: issue.severity, plot: "A/1", row: "4", code: issue.code });
  assert.ok(found.includes(issue));
  assert.equal(filterQuality(view.issues, view.records, { severity: issue.severity, plot: "B", row: "4", code: issue.code }).length, 0);
});

test("fuel comparison follows period filters and preserves missing, zero and invalid values", async () => {
  const { fuelByPlot } = await import("../lib/interactive-monitoring");
  const input = [
    row({ no: 1, plotCode: "A", date: "01/10/2026", fuelRefill: 10, actualFuelUsage: 5 }),
    row({ no: 2, plotCode: "A", date: "02/10/2026", fuelRefill: 0, actualFuelUsage: 0 }),
    row({ no: 3, plotCode: "B", date: "02/10/2026", fuelRefill: "", actualFuelUsage: 0 }),
    row({ no: 4, plotCode: "C", date: "03/10/2026", fuelRefill: -5, actualFuelUsage: 7 }),
    row({ no: 5, plotCode: "A", date: "01/11/2026", fuelRefill: 500, actualFuelUsage: 500 }),
    row({ no: 6, plotCode: "D", date: "", fuelRefill: 900, actualFuelUsage: 900 }),
  ];
  const view = buildDashboardViewModel(input, { ...all, startDate: "2026-10-01", endDate: "2026-10-31" });
  assert.deepEqual(fuelByPlot(view.filteredValidatedRecords, view.inventory), [{ code: "A", refill: 10, consumption: 9999 }, { code: "B", refill: null, consumption: 9999 }, { code: "C", refill: null, consumption: 9999 }]);
  assert.equal(view.summary.totals.refill, 10);
  assert.equal(view.summary.totals.fuel, 12);
  assert.deepEqual(fuelByPlot([], view.inventory), []);
});


test("fuel comparison uses one source metadata value without changing period totals", async () => {
  const { fuelByPlot } = await import("../lib/interactive-monitoring");
  const input = [
    row({ no: 1, plotCode: "A", date: "01/10/2026", totalFuelConsumption: 550, fuelRefill: 100 }),
    row({ no: 2, plotCode: "A", date: "02/10/2026", totalFuelConsumption: "", fuelRefill: 50 }),
    row({ no: 3, plotCode: "A", date: "01/11/2026", totalFuelConsumption: 550, fuelRefill: 400 }),
    row({ no: 4, plotCode: "B", date: "01/10/2026", totalFuelConsumption: 300, fuelRefill: 20 }),
    row({ no: 5, plotCode: "B", date: "02/10/2026", totalFuelConsumption: 400, fuelRefill: 10 }),
    row({ no: 6, plotCode: "C", date: "03/10/2026", totalFuelConsumption: -1, fuelRefill: 5 }),
  ];
  const view = buildDashboardViewModel(input, { ...all, startDate: "2026-10-01", endDate: "2026-10-31" });
  assert.deepEqual(fuelByPlot(view.filteredValidatedRecords, view.inventory), [
    { code: "A", refill: 150, consumption: 550 },
    { code: "B", refill: 30, consumption: null },
    { code: "C", refill: 5, consumption: null },
  ]);
  assert.equal(view.summary.totals.refill, 185);
  assert.ok(view.issues.some((issue) => issue.field === "totalFuelConsumption" && issue.code === "metadata_conflict"));
  assert.ok(view.issues.some((issue) => issue.field === "totalFuelConsumption" && issue.code === "negative_value"));
  assert.deepEqual(view.inventory.find((plot) => plot.code === "A")?.cumulativeFuelMetadata.sourceRows.map((source) => source.row), [2, 4]);
});
