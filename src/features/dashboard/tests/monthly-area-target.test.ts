import assert from "node:assert/strict";
import { test } from "node:test";
import { MONTHLY_AREA_TARGET_HA } from "../config/monthly-target";
import { buildDashboardViewModel } from "../lib/build-dashboard-view-model";
import { filtersForPeriod } from "../lib/overview";
import { row } from "./fixtures";

const finished = "Garap Petak Selesai";
const filters = (month: string) => filtersForPeriod(month);

test("monthly target counts unique completed plots by completion date and resets each month", () => {
  const a = row({ no: 1, plotCode: "A", plotArea: 20, date: "30/10/2026", workStatus: finished });
  const data = [a, a, row({ no: 2, plotCode: "A", plotArea: 20, date: "31/10/2026", workStatus: finished }),
    row({ no: 3, plotCode: "B", plotArea: 40, date: "31/10/2026", workStatus: finished }),
    row({ no: 4, plotCode: "C", plotArea: 80, date: "01/11/2026", workStatus: finished }),
    row({ no: 5, plotCode: "D", plotArea: 9, date: "02/10/2026", workStatus: "Garap Petak Berlangsung" }),
    row({ no: 6, plotCode: "E", plotArea: 9, date: "03/10/2026", workStatus: "tidak dikenal" }),
    row({ no: 7, plotCode: "F", plotArea: 9, date: "04/10/2026", workStatus: "Selesai" })];
  const october = buildDashboardViewModel(data, filters("2026-10"));
  assert.equal(MONTHLY_AREA_TARGET_HA, 60);
  assert.equal(october.monthlyTarget.completedAreaHa, 60);
  assert.equal(october.monthlyTarget.achievementPercentage, 100);
  assert.equal(october.monthlyTarget.remainingAreaHa, 0);
  assert.equal(october.monthlyTarget.issues.length, 0);
  assert.equal(october.summary.totals.fuel, 600);
  assert.equal(october.summary.totals.hours, 60);
  const november = buildDashboardViewModel(data, filters("2026-11"));
  assert.equal(november.monthlyTarget.completedAreaHa, 80);
  assert.equal(november.monthlyTarget.achievementPercentage, 80 / 60 * 100);
  assert.equal(november.monthlyTarget.remainingAreaHa, 0);
  const selected = buildDashboardViewModel(data, { ...filters("2026-10"), plotCodes: ["A"] });
  assert.equal(selected.monthlyTarget.completedAreaHa, 20);
  assert.equal(selected.monthlyTarget.achievementPercentage, 20 / 60 * 100);
  assert.equal(selected.monthlyTarget.remainingAreaHa, 40);
  assert.equal(selected.summary.totals.fuel, 200);
  const noActivity = buildDashboardViewModel(data, filters("2026-12"));
  assert.equal(noActivity.monthlyTarget.completedAreaHa, 0);
  assert.equal(noActivity.monthlyTarget.remainingAreaHa, 60);
});

test("unverified areas of completed plots are excluded and reported with source references", () => {
  const data = [
    row({ no: 1, plotCode: "MISSING", plotArea: "", workStatus: finished }),
    row({ no: 2, plotCode: "ZERO", plotArea: 0, workStatus: finished }),
    row({ no: 3, plotCode: "INVALID", plotArea: "rusak", workStatus: finished }),
    row({ no: 4, plotCode: "CONFLICT", plotArea: 5, workStatus: finished }),
    row({ no: 5, plotCode: "CONFLICT", plotArea: 7, date: "02/10/2026", workStatus: "Garap Petak Berlangsung" }),
    row({ no: 6, plotCode: "VALID", plotArea: 12.25, workStatus: finished, remainingFuel: -15 }),
  ];
  const view = buildDashboardViewModel(data, filters("2026-10"), { worksheetName: "Fixture" });
  assert.equal(view.monthlyTarget.completedAreaHa, 12.25);
  assert.equal(view.monthlyTarget.achievementPercentage, 12.25 / 60 * 100);
  assert.equal(view.monthlyTarget.remainingAreaHa, 47.75);
  assert.equal(view.monthlyTarget.issues.length, 4);
  for (const reason of ["tidak tersedia", "bernilai nol", "tidak valid", "saling bertentangan"]) assert.ok(view.monthlyTarget.issues.some((issue) => issue.message.includes(reason)));
  assert.ok(view.issues.some((issue) => issue.code === "completion_area_excluded" && issue.source.worksheet === "Fixture" && issue.relatedRows?.includes(6)));
  assert.ok(view.issues.some((issue) => issue.code === "negative_value" && issue.field === "remainingFuel"));
  assert.equal(view.records.find((record) => record.plotCode === "VALID")?.remainingFuel, -15);
});

test("unbounded, partial and multi-month ranges do not apply a monthly target to mixed activity", () => {
  const data = [row({ plotArea: 30, workStatus: finished })];
  for (const [startDate, endDate] of [["", ""], ["2026-10-10", "2026-10-31"], ["2026-10-01", "2026-11-30"], ["2026-11-01", "2026-10-31"]]) {
    const view = buildDashboardViewModel(data, { startDate, endDate, plotCodes: [], selectedSpkNumbers: [], statuses: [] });
    assert.equal(view.monthlyTarget.month, null);
    assert.equal(view.monthlyTarget.completedAreaHa, null);
    assert.equal(view.monthlyTarget.achievementPercentage, null);
    assert.equal(view.monthlyTarget.remainingAreaHa, null);
  }
});
