import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAppearance, validateAppearance } from "../../settings/lib/appearance";

test("appearance accepts the verified worksheet contract and supported themes", () => {
  assert.deepEqual(parseAppearance([["Kunci", "Nilai"], ["nama_aplikasi", "Excavator"], ["warna_utama", "blue"]]), { name: "Excavator", theme: "blue" });
  assert.equal(parseAppearance([["Kunci", "Nilai"], ["warna_utama", "blue"], ["nama_aplikasi", "Excavator"]]), null);
  assert.equal(parseAppearance([["Kunci", "Nilai"], ["nama_aplikasi", "=A1"], ["warna_utama", "orange"]]), null);
  assert.equal(validateAppearance(" ", "orange"), null);
  assert.equal(validateAppearance("Nama", "#ffffff"), null);
  assert.equal(validateAppearance("Nama\nLain", "green"), null);
});
