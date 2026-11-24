import assert from "node:assert/strict";
import test from "node:test";
import { activityEditDraft, latestDatedPlotActivity, planActivityEdit, type PlotActivity } from "../../management/lib/plot-activity-edit";
import { isPlotFinished, parsePlotSheet, plotActivityAverageIndex, plotActivityHeaderIndex, plotActivityTotalIndex, toPlotSheetStatus } from "../../management/lib/plot-sheet";

test("plot activity writer index points at the header after the updated plot block", () => {
  const rows = [
    ["No. SPK"],
    ["Kode Petak", null, "12A/71C"],
    ["Harga Petak / Ha", null, 4910200],
    ["Total Nilai Petak", null, 43700780],
    ["Luas Petak", null, 8.9, "Hektar"],
    ["Total Konsumsi Solar", null, 0],
    [],
    ["No", "Tanggal", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)", "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Sisa/Stok Tangki (L)", "Status Pekerjaan", "Keterangan"],
    ...Array.from({ length: 7 }, (_, index) => [index + 1, 46335 + index, 304.1 + index, 310.1 + index, 6, 6, 0, 9.9, 59.4, 0, index === 6 ? "Garap Petak Berlangsung" : "", ""]),
    ["Total"],
    [],
    ["Rata-Rata"],
  ];
  const plot = parsePlotSheet(rows)[0];

  assert.ok(plot);
  assert.equal(plot.totalValue, 43700780);
  assert.equal(plot.totalFuelConsumption, 0);
  assert.equal(plot.sourceRow, 2);
  assert.equal(rows[plotActivityHeaderIndex(plot.sourceRow)]?.[0], "No");
  assert.equal(plotActivityTotalIndex(rows, plotActivityHeaderIndex(plot.sourceRow)), 15);
  assert.equal(plotActivityAverageIndex(rows, plotActivityTotalIndex(rows, plotActivityHeaderIndex(plot.sourceRow))), 17);
  assert.equal(plot.activities.length, 7);
  assert.equal(plot.activities[6]?.sourceRow, 15);
  assert.equal(plot.activities[6]?.workingHours, 6);
  assert.equal(isPlotFinished(plot.activities), false);
  plot.activities[6].workStatus = "Selesai";
  assert.equal(isPlotFinished(plot.activities), true);
  assert.equal(toPlotSheetStatus("Selesai"), "Garap Petak Selesai");
  assert.equal(toPlotSheetStatus("Dalam pengerjaan"), "Garap Petak Berlangsung");
  assert.equal(toPlotSheetStatus("Mulai pengerjaan"), "Mulai Garap Petak");
  assert.equal(toPlotSheetStatus("Status baru"), null);
});

const activity: PlotActivity = {
  sourceRow: 99, date: "2026-11-08", hmStart: 271.125, hmEnd: 283.125, workingHours: 12,
  estimatedWorkingHours: 12, fuelRefill: 150, fuelPerHour: 9.9, actualFuelUsage: 118.8,
  workStatus: "Dalam pengerjaan", notes: "Catatan semula",
};

test("activity edits target changed cells and preserve earlier measurement values on close", () => {
  const draft = activityEditDraft(activity);
  assert.equal(draft.hmStart, "271,125");
  const plan = planActivityEdit(activity, { ...draft, workStatus: "Selesai" }, "2026");
  assert.deepEqual(plan.cells?.map(({ column, value }) => [column, value]), [[10, "Garap Petak Selesai"]]);
  assert.ok(planActivityEdit(activity, { ...draft, workStatus: "constructor" }, "2026").error);
});

test("activity edits validate date, meter order, manual hours and volume", () => {
  const draft = activityEditDraft(activity);
  for (const changes of [{ date: "2026-11-31" }, { date: "2027-01-01" }, { hmEnd: "270" }, { workingHours: "11" }, { fuelRefill: "-2" }]) {
    assert.ok(planActivityEdit(activity, { ...draft, ...changes }, "2026").error);
  }
  const plan = planActivityEdit(activity, { ...draft, fuelRefill: "0", workingHours: "", estimatedWorkingHours: "" }, "2026");
  assert.deepEqual(plan.cells?.map(({ column }) => column), [4, 5, 6]);
  assert.ok(plan.cells?.[0].formula?.includes("D99-C99"));
  assert.equal(plan.cells?.[2].value, 0);
});

test("closing selects the last dated activity with sheet order as the same-day tiebreaker", () => {
  const activities = [activity, { ...activity, sourceRow: 100 }, { ...activity, sourceRow: 101, date: "2026-11-07" }, { ...activity, sourceRow: 102, date: null }];
  assert.equal(latestDatedPlotActivity(activities)?.sourceRow, 100);
});
