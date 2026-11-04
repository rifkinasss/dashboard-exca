import assert from "node:assert/strict";
import { test } from "node:test";
import { createWithdrawalWrite } from "../lib/fuel-withdrawal-write";

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
  assert.equal(result.requests.length, 4);
});

test("never plans writes across merged cells", () => {
  const result = createWithdrawalWrite([h, [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [{ startRowIndex: 5, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 1 }] });
  assert.equal(result.ok, false);
});

test("requires all six headers and protects merged price cells", () => {
  assert.equal(createWithdrawalWrite([["No", "Tanggal Ambil", "Solar", "No Petak"], [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [] }).ok, false);
  assert.equal(createWithdrawalWrite([h, [1, 46327, 100, "A"]], input, { sheetId: 1, rowCount: 100, merges: [{ startRowIndex: 5, endRowIndex: 6, startColumnIndex: 4, endColumnIndex: 6 }] }).ok, false);
});
