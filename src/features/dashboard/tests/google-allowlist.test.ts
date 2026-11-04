import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedGoogleAccount } from "../../auth/allowlist";

test("requires a verified Google email in the configured allowlist", () => {
  assert.equal(isAllowedGoogleAccount(" User@Example.com ", true, "user@example.com,other@example.com"), true);
  assert.equal(isAllowedGoogleAccount("user@example.com", false, "user@example.com"), false);
  assert.equal(isAllowedGoogleAccount("user@example.com", true, undefined), false);
  assert.equal(isAllowedGoogleAccount("user@example.com.evil.test", true, "user@example.com"), false);
});
