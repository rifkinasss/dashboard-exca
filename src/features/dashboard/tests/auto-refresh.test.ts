import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRefreshData } from "../../shared/lib/auto-refresh";

test("automatic refresh waits for the interval and an idle visible page", () => {
  assert.equal(shouldRefreshData(59_999, 0, 60_000, true, false, false), false);
  assert.equal(shouldRefreshData(60_000, 0, 60_000, true, false, false), true);
  assert.equal(shouldRefreshData(60_000, 0, 60_000, false, false, false), false);
  assert.equal(shouldRefreshData(60_000, 0, 60_000, true, true, false), false);
  assert.equal(shouldRefreshData(60_000, 0, 60_000, true, false, true), false);
});
