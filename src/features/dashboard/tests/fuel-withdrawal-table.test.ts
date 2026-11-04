import assert from "node:assert/strict";
import { test } from "node:test";
import { planWithdrawalTable } from "../lib/fuel-withdrawal-table";

const h = ["No", "Tanggal Ambil", "Solar", "No Petak"];
const october = [1, 46305, 100, "A"];
const november = [1, 46327, 150, "B"];

test("plans existing months and new tables without changing source", () => {
  const values = [h, october, [], [], h, november];
  assert.deepEqual(planWithdrawalTable(values, "2026-10-15"), { ok: true, kind: "existing-month", dataRow: 6, number: 2 });
  assert.deepEqual(planWithdrawalTable(values, "2026-11-03"), { ok: true, kind: "existing-month", dataRow: 10, number: 2 });
  assert.deepEqual(planWithdrawalTable(values, "2026-12-03"), { ok: true, kind: "new-month", headerRow: 11, dataRow: 12, number: 1 });
  assert.equal(values.length, 6);
});

test("refuses full earlier table, mixed periods, duplicate months and bad rows", () => {
  assert.equal(planWithdrawalTable([h, october, h, november], "2026-10-31").ok, false);
  assert.equal(planWithdrawalTable([h, october, november], "2026-10-31").ok, false);
  assert.equal(planWithdrawalTable([h, october, h, october], "2026-10-31").ok, false);
  assert.equal(planWithdrawalTable([h, [1, 46305, -5, "A"]], "2026-10-31").ok, false);
});
