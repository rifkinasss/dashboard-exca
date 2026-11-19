import assert from "node:assert/strict";
import test from "node:test";
import { parsePlotMeasurement } from "../../management/lib/plot-measurement";

test("plot HM and fuel measurements accept dot and comma decimal input", () => {
  assert.deepEqual(parsePlotMeasurement("304.1"), { state: "valid", value: 304.1 });
  assert.deepEqual(parsePlotMeasurement("310.1"), { state: "valid", value: 310.1 });
  assert.deepEqual(parsePlotMeasurement("6,8"), { state: "valid", value: 6.8 });
  assert.deepEqual(parsePlotMeasurement("1.000"), { state: "valid", value: 1000 });
});
