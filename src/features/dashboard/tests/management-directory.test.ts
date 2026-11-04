import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManagementDirectory } from "../../management/lib/build-management-directory";
import { row } from "./fixtures";

const operations = [
  row({ no: 1, spkNumber: "001", plotCode: "PTK-A", plotArea: 5, date: "01/10/2026", hmStart: 100, hmEnd: 110, workingHours: 10, fuelRefill: 10, actualFuelUsage: 8, workStatus: "Mulai pengerjaan" }),
  row({ no: 2, spkNumber: "", plotCode: "", plotArea: 5, date: "02/10/2026", hmStart: 110, hmEnd: 112, workingHours: 2, fuelRefill: 0, actualFuelUsage: 2, workStatus: "Dalam pengerjaan" }),
  row({ no: 1, spkNumber: "001", plotCode: "PTK-A", plotArea: 5, date: "01/10/2026", hmStart: 100, hmEnd: 110, workingHours: 10, fuelRefill: 10, actualFuelUsage: 8, workStatus: "Mulai pengerjaan" }),
  row({ no: 4, spkNumber: "002", plotCode: "PTK-B", plotArea: 7, date: "04/10/2026", hmStart: 200, hmEnd: 205, workingHours: 5, fuelRefill: 5, actualFuelUsage: 4, workStatus: "Selesai" }),
  row({ no: 5, spkNumber: "003", plotCode: "PTK-C", plotArea: 0, date: "", hmStart: "", hmEnd: "", workingHours: "", fuelRefill: "", actualFuelUsage: "", workStatus: "" }),
];
const financial = [
  [1, "001", "PTK-A", 5, 100, 500, 2, 10, 20, 100, 80],
  [2, "001", "PTK-A", 5, 100, 500, 2, 10, 20, 100, 80],
  [3, "002", "PTK-B", 7, 100, 700, 2, 20, 40, 200, 160],
];

test("management read models preserve inventory, merge provenance, and canonical activity totals", () => {
  const result = buildManagementDirectory(operations, financial, {
    operationWorksheet: "Overview Operasional",
    operationSpkMerges: [{ startRow: 2, endRow: 3 }],
    operationPlotMerges: [{ startRow: 2, endRow: 3 }],
  });

  assert.deepEqual(result.plots.map((plot) => plot.code), ["PTK-A", "PTK-B", "PTK-C"]);
  const merged = result.plots[0];
  assert.deepEqual(merged.spks, ["001"]);
  assert.equal(merged.area, 5);
  assert.equal(merged.hours, 12);
  assert.equal(merged.fuel, 10);
  assert.equal(merged.refill, 10);
  assert.equal(merged.efficiency, 10 / 12);
  assert.deepEqual(merged.sourceRows, [2, 3, 4]);
  assert.deepEqual(merged.areaSourceRows, [2, 3, 4]);
  assert.deepEqual(merged.spkSourceRows, [2, 4]);
  assert.deepEqual(merged.plotCodeSourceRows, [2, 4]);
  assert.equal(merged.activityCount, 2);
  assert.equal(result.plots[2].activityCount, 0);
  assert.equal(result.plots[2].undatedCount, 1);
  assert.equal(result.plots[2].refill, null);
  assert.equal(result.plots[2].efficiency, null);
  assert.ok(result.plots[2].issues.some((issue) => issue.code === "undated_plot"));
});

test("SPK summaries do not multiply plot area and exclude duplicate financial keys", () => {
  const result = buildManagementDirectory(operations, financial, {
    operationWorksheet: "Overview Operasional",
    operationSpkMerges: [{ startRow: 2, endRow: 3 }],
    operationPlotMerges: [{ startRow: 2, endRow: 3 }],
  });

  const first = result.spks.find((item) => item.number === "001")!;
  const second = result.spks.find((item) => item.number === "002")!;
  const third = result.spks.find((item) => item.number === "003")!;
  assert.equal(first.verifiedArea, 5);
  assert.equal(first.activityCount, 2);
  assert.equal(first.finance.gross.value, null);
  assert.equal(first.finance.gross.verifiedCount, 0);
  assert.equal(second.verifiedArea, 7);
  assert.equal(second.finance.gross.value, 200);
  assert.equal(second.finance.fuelCost.value, 40);
  assert.equal(third.activityCount, 0);
  assert.equal(third.undatedCount, 1);
});

test("plot refill and consumption rate exclude undated, duplicate and unpaired measurements", () => {
  const records = [
    row({ no: 1, plotCode: "P1", date: "01/10/2026", fuelRefill: 100, hmStart: 1, hmEnd: 11, workingHours: 10, actualFuelUsage: 80 }),
    row({ no: 1, plotCode: "P1", date: "01/10/2026", fuelRefill: 100, hmStart: 1, hmEnd: 11, workingHours: 10, actualFuelUsage: 80 }),
    row({ no: 2, plotCode: "P1", date: "02/10/2026", fuelRefill: 50, actualFuelUsage: 30, hmStart: "", hmEnd: "", workingHours: "" }),
    row({ no: 3, plotCode: "P1", date: "", fuelRefill: 500, actualFuelUsage: 100, workingHours: 5 }),
  ];
  const plot = buildManagementDirectory(records, []).plots[0];
  assert.equal(plot.refill, 150);
  assert.equal(plot.efficiency, 8);
});
