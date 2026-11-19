import assert from "node:assert/strict";
import { test } from "node:test";
import { buttonForeground, parseAppearance, sameAppearance, secondaryChartColor, validateAppearance } from "../../settings/lib/appearance";

test("button text remains readable against the darker custom theme color", () => {
  assert.equal(buttonForeground("#FF000D"), "#fff");
  assert.equal(buttonForeground("#FFFFFF"), "#0F172A");
  assert.equal(buttonForeground("#000000"), "#fff");
});

test("appearance accepts the verified worksheet contract and supported themes", () => {
  assert.deepEqual(parseAppearance([["Kunci", "Nilai"], ["nama_aplikasi", "Excavator"], ["warna_utama", "blue"]]), { name: "Excavator", theme: "blue" });
  assert.equal(parseAppearance([["Kunci", "Nilai"], ["warna_utama", "blue"], ["nama_aplikasi", "Excavator"]]), null);
  assert.equal(parseAppearance([["Kunci", "Nilai"], ["nama_aplikasi", "=A1"], ["warna_utama", "orange"]]), null);
  assert.equal(validateAppearance(" ", "orange"), null);
  assert.deepEqual(validateAppearance("Nama", "#ffffff"), { name: "Nama", theme: "#ffffff" });
  assert.equal(validateAppearance("Nama", "#fff; color:red"), null);
  assert.equal(validateAppearance("Nama", "#xyzxyz"), null);
  assert.equal(validateAppearance("Nama\nLain", "green"), null);
});

test("settings detect changes to either stored name or color", () => {
  const stored = { name: "Excavator", theme: "orange" };
  assert.equal(sameAppearance(stored, { ...stored }), true);
  assert.equal(sameAppearance(stored, { ...stored, name: "Nama baru" }), false);
  assert.equal(sameAppearance(stored, { ...stored, theme: "blue" }), false);
});

test("the second chart series switches to orange for blue themes", () => {
  for (const theme of ["blue", "#2563eb", "#0EA5E9", "#6366F1"]) {
    assert.equal(secondaryChartColor(theme), "#EA580C", theme);
  }
  for (const theme of ["orange", "green", "#7C3AED", "#EEEEF0", "#ffffff"]) {
    assert.equal(secondaryChartColor(theme), "#2563EB", theme);
  }
});
