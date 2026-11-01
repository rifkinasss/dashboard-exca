import assert from "node:assert/strict";
import { test } from "node:test";
import { financePeriodRange, financePeriodSelection } from "../../finance/lib/period-filter";

test("finance period selection uses the existing date range for all, year, month, and custom dates", () => {
  assert.deepEqual(financePeriodSelection("", ""), { year: "", month: "", custom: false });
  assert.deepEqual(financePeriodRange("2026", ""), { start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual(financePeriodSelection("2026-01-01", "2026-12-31"), { year: "2026", month: "", custom: false });
  assert.deepEqual(financePeriodRange("2028", "02"), { start: "2028-02-01", end: "2028-02-29" });
  assert.deepEqual(financePeriodSelection("2028-02-01", "2028-02-29"), { year: "2028", month: "02", custom: false });
  assert.deepEqual(financePeriodSelection("2026-10-10", "2026-10-20"), { year: "", month: "", custom: true });
  assert.deepEqual(financePeriodRange("", ""), { start: "", end: "" });
});
