import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFuelWithdrawalInput } from "../lib/fuel-withdrawal-input";

test("validates an input without inferring or changing its plot identity", () => {
  const result = validateFuelWithdrawalInput({ date: "2026-11-03", plotCode: " 72a/j54 ", liters: "150,5" });
  assert.deepEqual(result, { ok: true, value: { date: "2026-11-03", plotCode: "72A/J54", liters: 150.5 } });
});

test("rejects invalid dates, missing plot codes, zero, and invalid quantities", () => {
  for (const value of ["0", "-1", "salah", ""]) {
    assert.equal(validateFuelWithdrawalInput({ date: "2026-11-03", plotCode: "A", liters: value }).ok, false);
  }
  assert.equal(validateFuelWithdrawalInput({ date: "1899-12-01", plotCode: "A", liters: "1" }).ok, false);
  assert.equal(validateFuelWithdrawalInput({ date: "2026-02-30", plotCode: "A", liters: "1" }).ok, false);
  assert.equal(validateFuelWithdrawalInput({ date: "2026-11-03", plotCode: "", liters: "1" }).ok, false);
});
