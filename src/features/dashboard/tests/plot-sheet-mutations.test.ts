import assert from "node:assert/strict";
import test from "node:test";
import { JWT } from "google-auth-library";
import { changePlot } from "../../management/data/server/plot-sheet-writer";
import { activityEditDraft } from "../../management/lib/plot-activity-edit";
import { parsePlotSheet } from "../../management/lib/plot-sheet";
import { mapPlot2026Overview } from "../data/server/google-sheets";
import { buildManagementDirectory } from "../../management/lib/build-management-directory";

test("Sheets mutations preserve row identity, update linked metadata, reject stale edits, and remove only the selected block", async (t) => {
  const header = ["No", "Tanggal", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)", "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Sisa/Stok Tangki (L)", "Status Pekerjaan", "Keterangan"];
  const block = (code: string) => [
    ["No. SPK", null, "123"], ["Kode Petak", null, code], ["Harga Petak / Ha", null, 10],
    ["Total Nilai Petak", null, 20], ["Luas Petak", null, 2], ["Total Konsumsi Solar", null, 30],
    [], header.slice(),
    [1, 46334, 10, 12, 2, 2, 20, 10, 20, 0, "Mulai Garap Petak", "Baris pertama"],
    [2, 46335, 12, 13, 1, 1, 10, 10, 10, 0, "Garap Petak Berlangsung", "Baris terakhir"],
    ["Total", null, null, null, 3], ["Rata-Rata", null, null, null, 1.5],
  ];
  const rows: unknown[][] = [[], ...block("UJI-A"), [], ...block("UJI-B")];
  const neighbor = structuredClone(rows.slice(14));
  const master = [
    ["No", "No. SPK", "Kode Petak", "Harga Per Hektar", "Keterangan"],
    [1, 123, "UJI-A", 10, "Harga kontrak"],
    [2, 123, "UJI-B", 10, ""],
  ];
  const fuel = [
    ["No", "Tanggal Ambil", "Solar", "No Petak", "Harga Solar", "Biaya Solar"],
    [1, 46334, 20, "UJI-A", 12, 240],
    [2, 46335, 5, "UJI-B", 12, 60],
  ];
  const env = {
    ENABLE_PLOT_WRITES: "true", PLOT_OPERATIONAL_SHEET_NAME: "2026", GOOGLE_SHEET_NAME: "2026",
    DASHBOARD_DATA_SOURCE: "google-sheets", GOOGLE_SPREADSHEET_ID: "test",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@example.com", GOOGLE_PRIVATE_KEY: "test",
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const original = JWT.prototype.request;
  let writes = 0;
  JWT.prototype.request = (async ({ url, data, params }) => {
    const path = decodeURIComponent(String(url));
    if (path.endsWith(":batchUpdate")) {
      writes++;
      type Update = { updateCells?: {
        start?: { sheetId: number; rowIndex: number; columnIndex: number };
        range: { startRowIndex: number; endRowIndex: number; startColumnIndex: number; endColumnIndex: number };
        rows: { values: { userEnteredValue?: { numberValue?: number; stringValue?: string; formulaValue?: string } }[] }[];
      } };
      for (const request of (data as { requests: Update[] }).requests) {
        const operation = request.updateCells;
        if (!operation) continue;
        if (operation.start) {
          const value = operation.rows[0].values[0].userEnteredValue;
          const { sheetId, rowIndex, columnIndex } = operation.start;
          const target = sheetId === 2 ? master[rowIndex - 4] : sheetId === 3 ? fuel[rowIndex - 3] : rows[rowIndex];
          target[columnIndex] = value?.numberValue ?? value?.stringValue ?? value?.formulaValue ?? null;
        } else {
          const { startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } = operation.range;
          for (let row = startRowIndex; row < endRowIndex; row++) {
            for (let column = startColumnIndex; column < endColumnIndex; column++) rows[row][column] = null;
          }
        }
      }
      return { data: {} };
    }
    if (path.endsWith("test")) return { data: { properties: { locale: "id_ID" }, sheets: [{ properties: { title: "2026", sheetId: 1 } }, { properties: { title: "Master Harga Petak", sheetId: 2 } }, { properties: { title: "Pengambilan Solar", sheetId: 3 } }] } };
    if (path.endsWith("'Master Harga Petak'!A5:E")) return { data: { values: structuredClone(master) } };
    if (path.endsWith("'Master Harga Petak'!B6:D6")) return { data: { values: [master[1].slice(1, 4)] } };
    if (path.endsWith("'Pengambilan Solar'!A4:F")) return { data: { values: structuredClone(fuel) } };
    if (path.endsWith("'Pengambilan Solar'!D4:D")) return { data: { values: fuel.map((row) => [row[3]]) } };
    const values = structuredClone(rows);
    if (params?.valueRenderOption !== "FORMULA") {
      for (const row of values) {
        const refs = typeof row[2] === "string" && /^=C(\d+)\*C(\d+)$/.exec(row[2]);
        if (refs) row[2] = Number(rows[Number(refs[1]) - 1][2]) * Number(rows[Number(refs[2]) - 1][2]);
      }
    }
    if (path.endsWith("!A:L")) return { data: { values } };
    const match = /!A(\d+):[CL](\d+)$/.exec(path);
    assert.ok(match, path);
    return { data: { values: values.slice(Number(match[1]) - 1, Number(match[2])) } };
  }) as typeof original;
  t.after(() => { JWT.prototype.request = original; });

  const initial = parsePlotSheet(rows)[0];
  const [first, last] = initial.activities;
  const code = initial.code;
  rows[last.sourceRow - 1][9] = `=IF(AND(G${last.sourceRow}="";I${last.sourceRow}="");"";J${first.sourceRow}+G${last.sourceRow}-I${last.sourceRow})`;
  const edit = { kind: "edit" as const, code, sourceRow: last.sourceRow, snapshot: JSON.stringify(last), draft: { ...activityEditDraft(last), notes: "Diperbarui", fuelRefill: "15,5" }, close: false };
  assert.equal((await changePlot(edit, "test@example.com")).ok, true);
  assert.deepEqual(parsePlotSheet(rows)[0].activities[0], first);
  assert.equal(parsePlotSheet(rows)[0].activities[1].fuelRefill, 15.5);
  assert.equal((await changePlot(edit, "test@example.com")).ok, false);
  const updated = parsePlotSheet(rows)[0].activities[1];
  assert.equal((await changePlot({ ...edit, snapshot: JSON.stringify(updated), close: true }, "test@example.com")).ok, true);
  const directory = () => buildManagementDirectory(mapPlot2026Overview({ values: rows }, true), [], {
    operationWorksheet: "2026", sheetPlotWorksheet: "2026", sheetPlots: parsePlotSheet(rows),
  });
  assert.equal(directory().plots[0].status, "Selesai");
  assert.equal(directory().plots[0].completionDate, updated.date);
  assert.equal(directory().plots[0].activities[1].sheetActivity?.notes, "Diperbarui");
  const metadataEdit = {
    kind: "metadata" as const, code, sourceRow: initial.sourceRow, nextCode: "UJI-BARU", spk: "456", pricePerHa: 15, area: 3,
    previous: { spk: initial.spk, pricePerHa: initial.pricePerHa, area: initial.area },
  };
  assert.equal((await changePlot({ ...metadataEdit, nextCode: "uji-b" }, "test@example.com")).ok, false);
  assert.equal((await changePlot({ ...metadataEdit, previous: { ...metadataEdit.previous, area: 99 } }, "test@example.com")).ok, false);
  master[1][3] = 12;
  assert.equal((await changePlot(metadataEdit, "test@example.com")).ok, false);
  master[1][3] = 10;
  assert.equal((await changePlot(metadataEdit, "test@example.com")).ok, true);
  const changedPlot = parsePlotSheet(rows)[0];
  assert.deepEqual([changedPlot.code, changedPlot.spk, changedPlot.pricePerHa, changedPlot.area], ["UJI-BARU", "456", 15, 3]);
  assert.equal(rows[initial.sourceRow + 1][2], `=C${initial.sourceRow + 1}*C${initial.sourceRow + 3}`);
  assert.deepEqual(master[1], [1, "456", "UJI-BARU", 15, "Harga kontrak"]);
  assert.deepEqual(master[2], [2, 123, "UJI-B", 10, ""]);
  assert.deepEqual(fuel[1], [1, 46334, 20, "UJI-BARU", 12, 240]);
  assert.deepEqual(fuel[2], [2, 46335, 5, "UJI-B", 12, 60]);
  assert.equal((await changePlot(metadataEdit, "test@example.com")).ok, false);
  const removeActivity = { kind: "delete-activity" as const, code: metadataEdit.nextCode, sourceRow: first.sourceRow, snapshot: JSON.stringify(first) };
  assert.equal((await changePlot({ ...removeActivity, snapshot: "stale" }, "test@example.com")).ok, false);
  assert.equal((await changePlot(removeActivity, "test@example.com")).ok, true);
  assert.deepEqual(parsePlotSheet(rows)[0].activities.map(({ sourceRow, notes }) => [sourceRow, notes]), [[last.sourceRow, "Diperbarui"]]);
  assert.equal(rows[first.sourceRow - 1][0], 1);
  assert.ok(String(rows[last.sourceRow - 1][9]).includes(`ISNUMBER(J${first.sourceRow}:J${last.sourceRow - 1})`));
  assert.equal(directory().plots.find(({ code }) => code === metadataEdit.nextCode)?.status, "Selesai");
  assert.equal((await changePlot(removeActivity, "test@example.com")).ok, false);
  assert.equal((await changePlot({ kind: "delete", code: metadataEdit.nextCode, sourceRow: initial.sourceRow }, "test@example.com")).ok, true);
  assert.deepEqual(directory().plots.map(({ code }) => code), ["UJI-B"]);
  assert.deepEqual(rows.slice(14), neighbor);
  assert.deepEqual(rows[8], header);
  assert.equal(writes, 5);
});
