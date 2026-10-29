import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOverview, normalizePlotCode, normalizeWorkStatus, parseOverviewDate, parseOverviewNumber } from "../lib/normalize-overview";
import { overviewColumns } from "../types";
import { row } from "./fixtures";

test("Indonesian decimals, grouping and negative values use an explicit policy", () => {
  for (const [input, expected] of [["9,9", 9.9], ["1.460", 1460], ["1.460,25", 1460.25], ["1.234.567", 1234567], ["-12,5", -12.5], ["0", 0], [0, 0], [9.9, 9.9]] as const) {
    assert.deepEqual(parseOverviewNumber(input, "id-ID"), { state: "valid", value: expected });
  }
  assert.deepEqual(parseOverviewNumber("9,9"), { state: "valid", value: 9.9 });
  assert.equal(parseOverviewNumber("1.460").state, "invalid");
  assert.equal(parseOverviewNumber("9.9", "id-ID").state, "invalid");
});

test("missing, invalid, and zero are distinct; malformed separators are rejected", () => {
  for (const input of [null, undefined, "", "  "]) assert.deepEqual(parseOverviewNumber(input), { state: "missing", value: null });
  for (const input of ["1,460.25", "1.46.000", "1,2,3", "12 L", "NaN", "Infinity", "1e3", true, NaN, Infinity, -Infinity]) {
    assert.deepEqual(parseOverviewNumber(input, "id-ID"), { state: "invalid", value: null });
  }
  assert.deepEqual(parseOverviewNumber("0"), { state: "valid", value: 0 });
});

test("calendar dates normalize without timezone conversion or current-date fallback", () => {
  for (const input of ["2026-10-29", "29/10/2026", "29-10-2026", "29 Oktober 2026", " 29 oktober 2026 "]) {
    assert.deepEqual(parseOverviewDate(input), { state: "valid", value: "2026-10-29" });
  }
  assert.equal(parseOverviewDate("1/2/2026").value, "2026-02-01");
  assert.equal(parseOverviewDate("29/02/2024").value, "2024-02-29");
  for (const input of ["29/02/2026", "2026-02-30", "31/04/2026", "10/29/2026", "29/10/26", "yesterday", "29 Oktoberr 2026", "2026-10-29T00:00:00Z", 46324]) {
    assert.deepEqual(parseOverviewDate(input), { state: "invalid", value: null });
  }
  assert.equal(parseOverviewDate("").state, "missing");
});

test("plot and known status normalization is conservative", () => {
  assert.equal(normalizePlotCode(" ptk-01 ").value, "PTK-01");
  assert.equal(normalizePlotCode(101).value, "101");
  assert.equal(normalizePlotCode(" ").state, "missing");
  assert.equal(normalizePlotCode(false).state, "invalid");
  assert.equal(normalizeWorkStatus(" DALAM  PENGERJAAN ").value, "Dalam pengerjaan");
  assert.equal(normalizeWorkStatus(" Selesai ").value, "Selesai");
  assert.equal(normalizeWorkStatus("Other status").state, "invalid");
});

test("all 15 columns map to canonical fields with source rows and cell states", () => {
  assert.equal(overviewColumns.length, 15);
  assert.equal(overviewColumns.map((column) => column.column).join(""), "ABCDEFGHIJKLMNO");
  const raw = row({ no: "", actualFuelUsage: "bad", fuelRefill: "0" });
  const result = normalizeOverview([raw], { firstDataRow: 25 });
  const record = result.records[0];
  const expected = [null, "PTK-01", 4.8, 9999, "2026-10-01", 100, 110, 10, 65, 0, 999, null, 80, "Dalam pengerjaan", "Fixture sintetis"];
  assert.deepEqual(overviewColumns.map(({ field }) => record[field]), expected);
  assert.deepEqual(record.source, { worksheet: "Overview", row: 25 });
  assert.equal(record.cellStates.no, "missing");
  assert.equal(record.cellStates.actualFuelUsage, "invalid");
  assert.equal(record.cellStates.fuelRefill, "valid");
  assert.ok(result.issues.some((issue) => issue.source.row === 25 && issue.field === "actualFuelUsage" && issue.code === "invalid_value"));
  assert.notEqual(record.raw, raw);
});

test("truncated and extended rows remain traceable; source row configuration is checked", () => {
  const short = normalizeOverview([[]]);
  assert.equal(short.records[0].date, null);
  assert.equal(short.records[0].plotCode, "");
  assert.ok(short.issues.some((issue) => issue.field === "plotCode" && issue.severity === "error"));
  const extended = normalizeOverview([[...row(), "extra"]]);
  assert.equal(extended.records[0].raw.length, 16);
  assert.ok(extended.issues.some((issue) => issue.code === "column_count"));
  assert.throws(() => normalizeOverview([], { firstDataRow: 0 }), RangeError);
});
