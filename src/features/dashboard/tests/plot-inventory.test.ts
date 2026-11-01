import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { defaultFilters, filtersForPeriod } from "../lib/overview";
import { normalizeWorkStatus } from "../lib/normalize-overview";
import { row } from "./fixtures";

const rows = [
  row({ no: 1, plotCode: "SYN-A", plotArea: 1, totalFuelConsumption: 100, date: "11/10/2026", workStatus: "Mulai Garap Petak" }),
  row({ no: 2, plotCode: "SYN-B", plotArea: 2, totalFuelConsumption: 200, date: "17/10/2026", workStatus: "Garap Petak Berlangsung" }),
  row({ no: 3, plotCode: "SYN-C", plotArea: 3, totalFuelConsumption: 300, date: "20/10/2026", workStatus: "Garap Petak Selesai" }),
  row({ no: 4, plotCode: "SYN-D", plotArea: 4, totalFuelConsumption: 400, date: "24/10/2026", workStatus: "Garap Petak Berlangsung" }),
  row({ no: 5, plotCode: "SYN-E", plotArea: "5,5", totalFuelConsumption: 500, date: "29/10/2026", workStatus: "Garap Petak Berlangsung" }),
  row({ no: 6, plotCode: "SYN-E", plotArea: "", totalFuelConsumption: "", date: "03/11/2026", workStatus: "Garap Petak Selesai" }),
];
const all = { ...defaultFilters, startDate: "", endDate: "" };

test("five registered plots remain available when November has only one active plot", () => {
  const original = structuredClone(rows);
  const view = buildDashboardViewModel(rows, filtersForPeriod("2026-11"));
  assert.deepEqual(view.plotCodes, ["SYN-A", "SYN-B", "SYN-C", "SYN-D", "SYN-E"]);
  assert.equal(view.inventory.length, 5);
  assert.equal(view.visibleInventory.length, 5);
  assert.equal(view.summary.totals.plotCount, 1);
  assert.deepEqual(view.inventory.filter((plot) => plot.hasActivity).map((plot) => plot.code), ["SYN-E"]);
  assert.equal(view.inventory.filter((plot) => !plot.hasActivity).length, 4);
  assert.equal(view.summary.totals.fuel, 100);
  assert.equal(view.summary.totals.hours, 10);
  assert.equal(view.summary.totals.refill, 120);
  assert.equal(view.summary.totals.efficiency, 10);
  assert.equal(view.inventory.find((plot) => plot.code === "SYN-A")?.fuel, null);
  assert.deepEqual(rows, original);
  assert.equal(buildDashboardViewModel(rows, filtersForPeriod("2026-10")).summary.totals.plotCount, 5);
  assert.equal(buildDashboardViewModel(rows, all).summary.totals.fuel, 600);
});

test("merged D/E candidates retain provenance without rewriting later activity or summing E", () => {
  const view = buildDashboardViewModel(rows, filtersForPeriod("2026-11"), { worksheetName: "Fixture" });
  const plot = view.inventory.find((item) => item.code === "SYN-E")!;
  assert.equal(plot.area, 5.5);
  assert.equal(view.summary.totals.area, 5.5);
  assert.deepEqual(plot.areaMetadata.sourceRows, [{ worksheet: "Fixture", row: 6 }]);
  assert.deepEqual(plot.cumulativeFuelMetadata, { value: 500, sourceRows: [{ worksheet: "Fixture", row: 6 }], requiresReview: false });
  assert.equal(view.filteredRecords[0].plotArea, null);
  assert.equal(view.filteredRecords[0].totalFuelConsumption, null);
  assert.equal(view.filteredRecords[0].raw[3], "");
  assert.equal(view.filteredRecords[0].source.row, 7);
  assert.ok(!view.issues.some((issue) => issue.source.row === 7 && issue.code === "missing_value" && (issue.field === "plotArea" || issue.field === "totalFuelConsumption")));
  assert.equal(view.summary.totals.fuel, 100);
});

test("undated-only plots are registered and warned but never add to dated KPIs", () => {
  const undated = row({ no: 7, plotCode: "SYN-F", date: "", actualFuelUsage: 999, plotArea: 8, totalFuelConsumption: 9999 });
  const view = buildDashboardViewModel([...rows, undated], all);
  assert.equal(view.inventory.length, 6);
  assert.equal(view.summary.totals.plotCount, 5);
  assert.equal(view.summary.totals.fuel, 600);
  assert.equal(view.filteredRecords.length, 6);
  assert.equal(view.excludedRows, 1);
  assert.ok(view.issues.some((issue) => issue.code === "undated_plot" && issue.source.row === 8));
  assert.equal(view.inventory.find((plot) => plot.code === "SYN-F")?.hasActivity, false);
});

test("metadata never crosses plot codes and missing values are not assumed zero", () => {
  const data = [row({ plotCode: "SYN-A", plotArea: 5, totalFuelConsumption: 100 }),
    row({ no: 2, plotCode: "SYN-B", plotArea: "", totalFuelConsumption: "", date: "02/10/2026" })];
  const view = buildDashboardViewModel(data, all);
  const first = view.inventory.find((plot) => plot.code === "SYN-A")!;
  const second = view.inventory.find((plot) => plot.code === "SYN-B")!;
  assert.equal(first.area, 5);
  assert.equal(second.area, null);
  assert.deepEqual(second.areaMetadata.sourceRows, []);
  assert.deepEqual(second.cumulativeFuelMetadata.sourceRows, []);
  const unassigned = buildDashboardViewModel([row({ plotCode: "", plotArea: 9, totalFuelConsumption: 50 }), ...data], all);
  assert.ok(unassigned.issues.some((issue) => issue.code === "metadata_unassigned" && issue.field === "plotArea" && issue.source.row === 2));
  assert.equal(unassigned.inventory.find((plot) => plot.code === "SYN-B")?.area, null);
});

test("conflicting or zero plot metadata is reported without choosing a value", () => {
  const data = [row({ plotArea: 1, totalFuelConsumption: 10 }), row({ no: 2, date: "02/10/2026", plotArea: 2, totalFuelConsumption: 20 })];
  const view = buildDashboardViewModel(data, all);
  const plot = view.inventory[0];
  assert.equal(plot.area, null);
  assert.equal(plot.cumulativeFuelMetadata.value, null);
  assert.equal(plot.cumulativeFuelMetadata.requiresReview, true);
  assert.deepEqual(plot.cumulativeFuelMetadata.sourceRows.map((source) => source.row), [2, 3]);
  assert.ok(view.issues.some((issue) => issue.code === "metadata_conflict" && issue.field === "totalFuelConsumption"));
  assert.equal(view.summary.totals.fuel, 200);
  const zero = buildDashboardViewModel([row({ plotArea: 0 })], all);
  assert.equal(zero.records[0].plotArea, 0);
  assert.equal(zero.inventory[0].area, null);
  assert.ok(zero.issues.some((issue) => issue.code === "zero_area"));
  const mixed = buildDashboardViewModel([row({ plotArea: 0 }), row({ no: 2, date: "02/10/2026", plotArea: 5 })], all);
  assert.equal(mixed.inventory[0].area, null);
  assert.ok(mixed.issues.some((issue) => issue.code === "area_conflict"));
});

test("real status labels remain distinct and inventory uses history only up to period end", () => {
  assert.equal(normalizeWorkStatus("Mulai Garap Petak").value, "Mulai pengerjaan");
  assert.equal(normalizeWorkStatus("Garap Petak Berlangsung").value, "Dalam pengerjaan");
  assert.equal(normalizeWorkStatus("Garap Petak Selesai").value, "Selesai");
  assert.equal(normalizeWorkStatus("Status baru").state, "invalid");
  const history = [
    row({ no: 1, date: "01/10/2026", workStatus: "Mulai Garap Petak" }),
    row({ no: 2, date: "20/10/2026", workStatus: "Garap Petak Berlangsung" }),
    row({ no: 3, date: "03/11/2026", workStatus: "Garap Petak Selesai" }),
  ];
  const earlyNovember = buildDashboardViewModel(history, { ...defaultFilters, startDate: "2026-11-01", endDate: "2026-11-02" });
  assert.equal(earlyNovember.inventory[0].status, "Dalam pengerjaan");
  assert.equal(earlyNovember.inventory[0].hasActivity, false);
  assert.equal(buildDashboardViewModel(history, all).inventory[0].status, "Selesai");
  assert.equal(buildDashboardViewModel(history, { ...defaultFilters, endDate: "2026-10-05" }).inventory[0].status, "Mulai pengerjaan");
});

test("negative tank and inconsistent HM are reported without altering unrelated fuel", () => {
  const view = buildDashboardViewModel([row({ remainingFuel: -3, workingHours: 8 })], all);
  assert.ok(view.issues.some((issue) => issue.code === "negative_value" && issue.field === "remainingFuel"));
  assert.ok(view.issues.some((issue) => issue.code === "hm_mismatch"));
  assert.equal(view.records[0].remainingFuel, -3);
  assert.equal(view.summary.totals.fuel, 100);
  assert.equal(view.summary.totals.hours, null);
});

test("worked area sums unique active plot metadata including source zeros", () => {
  const data = [
    row({ no: 1, plotCode: "A", plotArea: 8.6 }),
    row({ no: 2, plotCode: "A", plotArea: "", date: "02/10/2026" }),
    row({ no: 3, plotCode: "B", plotArea: 7.1 }),
    row({ no: 4, plotCode: "C", plotArea: 0 }),
    row({ no: 5, plotCode: "D", plotArea: 0 }),
    row({ no: 6, plotCode: "E", plotArea: 22.2 }),
    row({ no: 7, plotCode: "F", plotArea: 8.56, date: "" }),
  ];
  const view = buildDashboardViewModel(data, all);
  assert.equal(Number(view.workedArea.value?.toFixed(1)), 37.9);
  assert.equal(view.workedArea.zeroCount, 2);
  assert.equal(view.workedArea.unavailableCount, 0);
  assert.equal(view.summary.totals.area, null);
  assert.equal(view.issues.filter((issue) => issue.code === "zero_area").length, 2);
  const partial = buildDashboardViewModel([...data, row({ no: 8, plotCode: "G", plotArea: "" })], all);
  assert.equal(Number(partial.workedArea.value?.toFixed(1)), 37.9);
  assert.equal(partial.workedArea.unavailableCount, 1);
  const conflict = buildDashboardViewModel([...data, row({ no: 9, plotCode: "C", plotArea: 2, date: "02/10/2026" })], all);
  assert.equal(conflict.workedArea.unavailableCount, 1);
  assert.equal(conflict.workedArea.zeroCount, 1);
  assert.ok(conflict.issues.some((issue) => issue.code === "area_conflict"));
  assert.equal(buildDashboardViewModel(data, { ...all, startDate: "2026-11-01" }).workedArea.value, null);
});
