import assert from "node:assert/strict";
import { test } from "node:test";
import { createWithdrawalEdit, createWithdrawalWrite } from "../lib/fuel-withdrawal-write";
import { parseFuelWithdrawals } from "../lib/fuel-withdrawals";

const h = ["No", "Tanggal Ambil", "Solar", "No Petak", "Harga Solar", "Biaya Solar"];
const input = { date: "2026-11-02", plotCode: "72A/J54", liters: 150, price: 24500 };

test("plans an atomic write into the correct month and stores plot codes as literal strings", () => {
  const result = createWithdrawalWrite([h, [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.dataRow, 6);
  assert.deepEqual(result.rowValues, [2, 46328, 150, "72A/J54", 24500, 3675000]);
  assert.equal(result.requests.length, 2);
});

test("new month appends header and expands grid only when necessary", () => {
  const result = createWithdrawalWrite([h, [1, 46305, 100, "A"]], input, { sheetId: 1, rowCount: 5, merges: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.firstRow, 6);
  assert.equal(result.dataRow, 8);
  assert.equal(result.requests.length, 6);
  const copies = result.requests.filter((request) => "copyPaste" in request) as { copyPaste: { source: { startColumnIndex: number; endColumnIndex: number }; destination: { startColumnIndex: number; endColumnIndex: number }; pasteType: string } }[];
  assert.equal(copies.length, 2);
  for (const { copyPaste } of copies) {
    assert.equal(copyPaste.pasteType, "PASTE_FORMAT");
    assert.deepEqual([copyPaste.source.startColumnIndex, copyPaste.source.endColumnIndex], [0, 6]);
    assert.deepEqual([copyPaste.destination.startColumnIndex, copyPaste.destination.endColumnIndex], [0, 6]);
  }
});

test("never plans writes across merged cells", () => {
  const result = createWithdrawalWrite([h, [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [{ startRowIndex: 5, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 1 }] });
  assert.equal(result.ok, false);
});

test("requires all six headers and protects merged price cells", () => {
  assert.equal(createWithdrawalWrite([["No", "Tanggal Ambil", "Solar", "No Petak"], [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [] }).ok, false);
  assert.equal(createWithdrawalWrite([h, [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [{ startRowIndex: 5, endRowIndex: 6, startColumnIndex: 4, endColumnIndex: 6 }] }).ok, false);
});

test("edit keeps the recorded price, recalculates cost, and writes only the selected row", () => {
  const values = [h, [1, 46327, 100, "A", 24500, 2450000]];
  const original = parseFuelWithdrawals(values).records[0];
  const result = createWithdrawalEdit(values, original, { date: original.date, plotCode: "A", liters: 150 }, null, { sheetId: 1, rowCount: 100, merges: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.rowValues, [46327, 150, "A", 24500, 3675000]);
  assert.equal(result.requests[0].updateCells.start.rowIndex, 4);
  assert.equal(result.requests[0].updateCells.start.columnIndex, 1);
});

test("edit uses date-specific price, preserves missing historical prices and rejects stale rows", () => {
  const values = [h, [1, 46327, 100, "A", 24500, 2450000]];
  const original = parseFuelWithdrawals(values).records[0];
  const changed = createWithdrawalEdit(values, original, { date: "2026-11-02", plotCode: "A", liters: 100 }, 27500, { sheetId: 1, rowCount: 100, merges: [] });
  assert.equal(changed.ok, true);
  if (changed.ok) assert.deepEqual(changed.rowValues, [46328, 100, "A", 27500, 2750000]);
  const missingValues = [h, [1, 46327, 100, "A"]];
  const missing = parseFuelWithdrawals(missingValues).records[0];
  const noPrice = createWithdrawalEdit(missingValues, missing, { date: missing.date, plotCode: "A", liters: 150 }, null, { sheetId: 1, rowCount: 100, merges: [] });
  assert.equal(noPrice.ok, true);
  if (noPrice.ok) assert.deepEqual(noPrice.rowValues.slice(3), [null, null]);
  assert.equal(createWithdrawalEdit([h, [1, 46327, 101, "A", 24500, 2474500]], original, { date: original.date, plotCode: "A", liters: 150 }, null, { sheetId: 1, rowCount: 100, merges: [] }).ok, false);
  assert.equal(createWithdrawalEdit(values, original, { date: "2026-12-01", plotCode: "A", liters: 150 }, 27500, { sheetId: 1, rowCount: 100, merges: [] }).ok, false);
  assert.equal(createWithdrawalEdit(values, original, { date: original.date, plotCode: "A", liters: 150 }, null, { sheetId: 1, rowCount: 100, merges: [{ startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 }] }).ok, false);
});
