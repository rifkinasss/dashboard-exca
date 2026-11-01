import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardHref, dashboardPaths } from "../lib/dashboard-navigation";

test("dashboard navigation preserves shared multi-value filters only", () => {
  const source = "?start=2026-10-01&end=2026-10-31&spk=A%2F1&spk=B&plot=72C%2FJ54&status=Selesai&unrelated=discard";
  const link = dashboardHref(dashboardPaths.keuangan, source);
  const url = new URL(link, "https://example.test");
  assert.equal(url.pathname, dashboardPaths.keuangan);
  assert.deepEqual(url.searchParams.getAll("spk"), ["A/1", "B"]);
  assert.equal(url.searchParams.get("plot"), "72C/J54");
  assert.equal(url.searchParams.get("start"), "2026-10-01");
  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("unrelated"), false);
});

test("root redirect preserves operational status and does not manufacture filters", () => {
  assert.equal(dashboardHref(dashboardPaths.operasional, "", true), "/dashboard/operasional");
  assert.equal(new URL(dashboardHref(dashboardPaths.operasional, "?status=Selesai&spk=01", true), "https://example.test").searchParams.get("status"), "Selesai");
});
