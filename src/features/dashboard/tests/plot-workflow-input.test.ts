import assert from "node:assert/strict";
import { test } from "node:test";
import { monitorConsumption } from "../../management/lib/plot-workflow-input";

test("monitor consumption needs valid cumulative readings and never repairs a reset", () => {
  assert.deepEqual(monitorConsumption("1.000", "1.245,5"), { value: 245.5, error: null });
  assert.deepEqual(monitorConsumption("1.000", ""), { value: null, error: null });
  assert.ok(monitorConsumption("100", "99").error);
  assert.ok(monitorConsumption("-1", "").error);
  assert.deepEqual(monitorConsumption("0", "0"), { value: 0, error: null });
});
