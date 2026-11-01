import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { readFilters, searchSpkOptions, writeFilters } from "../lib/interactive-monitoring";
import { filtersForPeriod } from "../lib/overview";
import { normalizeOverview } from "../lib/normalize-overview";
import { row } from "./fixtures";

const october = filtersForPeriod("2026-10");
const data = [
  row({ no: 1, spkNumber: "A", plotCode: "P-1", plotArea: 10, date: "01/10/2026", workStatus: "Garap Petak Selesai", actualFuelUsage: 100 }),
  row({ no: 2, spkNumber: "", plotCode: "P-1", plotArea: "", date: "02/10/2026", workStatus: "Garap Petak Selesai", actualFuelUsage: 50 }),
  row({ no: 3, spkNumber: "B", plotCode: "P-1", plotArea: 10, date: "03/10/2026", workStatus: "Garap Petak Selesai", actualFuelUsage: 25 }),
  row({ no: 4, spkNumber: "C", plotCode: "P-2", plotArea: 20, date: "04/10/2026", workStatus: "Garap Petak Berlangsung", actualFuelUsage: 30 }),
  row({ no: 5, spkNumber: "D", plotCode: "P-3", plotArea: 5, date: "", actualFuelUsage: 900 }),
  row({ no: 6, spkNumber: "", plotCode: "P-4", plotArea: 2, date: "05/10/2026", actualFuelUsage: 10 }),
];
const options = { spkMerges: [{ startRow: 2, endRow: 3 }] };

test("merged SPK has explicit provenance, while missing or conflicting ownership is never guessed", () => {
  const result = normalizeOverview(data, options);
  assert.equal(result.records[1].spkNumber, "A");
  assert.equal(result.records[1].spkSource?.row, 2);
  assert.equal(result.records[1].source.row, 3);
  assert.equal(result.records[1].raw[1], "");
  assert.equal(result.records[5].spkNumber, null);
  assert.ok(result.issues.some((issue) => issue.field === "spkNumber" && issue.source.row === 7));
  const conflict = normalizeOverview(data, { spkMerges: [{ startRow: 2, endRow: 4 }] });
  assert.equal(conflict.records[1].spkNumber, null);
  assert.equal(conflict.records[2].spkNumber, null);
  assert.ok(conflict.issues.some((issue) => issue.code === "metadata_conflict" && issue.field === "spkNumber"));
  const overlap = normalizeOverview(data, { spkMerges: [{ startRow: 2, endRow: 3 }, { startRow: 2, endRow: 4 }] });
  assert.equal(overlap.records[0].spkNumber, null);
});

test("SPK selections combine with date, plot and status; inventory and KPIs stay distinct", () => {
  const all = buildDashboardViewModel(data, october, options);
  assert.equal(all.summary.totals.fuel, 215);
  assert.equal(all.inventory.length, 4);
  const one = buildDashboardViewModel(data, { ...october, selectedSpkNumbers: ["A"] }, options);
  assert.equal(one.summary.totals.fuel, 150);
  assert.deepEqual(one.visibleInventory.map((p) => p.code), ["P-1"]);
  assert.equal(one.monthlyTarget.completedAreaHa, 10);
  const many = buildDashboardViewModel(data, { ...october, selectedSpkNumbers: ["A", "B"] }, options);
  assert.equal(many.summary.totals.fuel, 175);
  assert.equal(many.monthlyTarget.completedAreaHa, 10);
  assert.equal(many.monthlyTarget.achievementPercentage, 10 / 60 * 100);
  const combined = buildDashboardViewModel(data, { ...october, selectedSpkNumbers: ["A", "C"], plotCodes: ["P-1", "P-2"], statuses: ["Selesai"], endDate: "2026-10-02" }, options);
  assert.equal(combined.filteredRecords.length, 2);
  assert.equal(combined.summary.totals.fuel, 150);
  const undated = buildDashboardViewModel(data, { ...october, selectedSpkNumbers: ["D"] }, options);
  assert.equal(undated.filteredRecords.length, 0);
  assert.deepEqual(undated.visibleInventory.map((p) => p.code), ["P-3"]);
  assert.equal(undated.monthlyTarget.completedAreaHa, 0);
});

test("search by SPK or plot and URL round-trip preserve selected values", () => {
  const view = buildDashboardViewModel(data, october, options);
  assert.deepEqual(searchSpkOptions(view.spkOptions, "p-1").map((item) => item.number), ["A", "B"]);
  assert.deepEqual(searchSpkOptions(view.spkOptions, "c").map((item) => item.number), ["C"]);
  assert.deepEqual(searchSpkOptions(view.spkOptions, "missing"), []);
  const selected = { ...october, selectedSpkNumbers: ["A", "B"] };
  assert.deepEqual(readFilters(writeFilters("?other=ok", selected), october), selected);
  assert.deepEqual(readFilters("?spk=A&spk=A&spk=B", october).selectedSpkNumbers, ["A", "B"]);
});
