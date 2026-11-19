import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loginDestination } from "../../auth/login-destination";

test("login returns to a local page and rejects external or recursive destinations", () => {
  assert.equal(loginDestination("/petak/123?filter=aktif"), "/petak/123?filter=aktif");
  for (const value of [undefined, "https://example.com", "//example.com", "/\\example.com", "/\t/example.com", "/login"]) {
    assert.equal(loginDestination(value), "/dashboard/operasional");
  }
});
