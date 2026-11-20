import assert from "node:assert/strict";
import test from "node:test";
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
