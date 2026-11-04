import assert from "node:assert/strict";
import { test } from "node:test";
import type { DashboardFilters } from "../types";
import { countActiveFilters, getPeriodValue, periodRange } from "../lib/filter-toolbar-state";

const filters: DashboardFilters = { startDate: "", endDate: "", plotCodes: [], selectedSpkNumbers: [], statuses: [] };

test("quick period maps all dates, available full months, and custom ranges without altering filters", () => {
  assert.deepEqual(periodRange("all"), { startDate: "", endDate: "" });
  assert.deepEqual(periodRange("2028-02"), { startDate: "2028-02-01", endDate: "2028-02-29" });
  assert.equal(periodRange("custom"), null);
  assert.equal(getPeriodValue(filters, ["2028-02"]), "all");
  assert.equal(getPeriodValue({ ...filters, startDate: "2028-02-01", endDate: "2028-02-29" }, ["2028-02"]), "2028-02");
  assert.equal(getPeriodValue({ ...filters, startDate: "2028-02-02", endDate: "2028-02-28" }, ["2028-02"]), "custom");
});

test("active filter count matches selected values and counts a date range once", () => {
  assert.equal(countActiveFilters(filters), 0);
  assert.equal(countActiveFilters({ ...filters, startDate: "2026-10-01", endDate: "2026-10-31", selectedSpkNumbers: ["SPK-1", "SPK-2"], plotCodes: ["72A1/J54"], statuses: ["Selesai"] }), 5);
});
