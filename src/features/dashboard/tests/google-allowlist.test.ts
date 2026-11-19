import assert from "node:assert/strict";
import { test } from "node:test";
import { activeViewerRow, administratorEmails, canInputTransactions, isManagedAdministrator, isAllowedGoogleAccount, isViewerAccount } from "../../auth/allowlist";

test("only operators can input transactions and their access can be revoked", () => {
  const users = [{ email: "operator@example.com", role: "operator" as const }, { email: "viewer@example.com", role: "viewer" as const }];
  assert.equal(canInputTransactions(" Operator@example.com ", users), true);
  assert.equal(canInputTransactions("viewer@example.com", users), false);
  assert.equal(canInputTransactions("operator@example.com", []), false);
  assert.equal(activeViewerRow([["Email", "Peran"], ["operator@example.com", "operator"]], "operator@example.com"), 2);
});

test("administrator list normalizes and removes empty and duplicate entries", () => {
  assert.deepEqual(administratorEmails(" Admin@Example.com, ,admin@example.com,other@example.com "), ["admin@example.com", "other@example.com"]);
  assert.deepEqual(administratorEmails(undefined), []);
});

test("requires a verified Google email in the configured allowlist", () => {
  assert.equal(isAllowedGoogleAccount(" User@Example.com ", true, "user@example.com,other@example.com"), true);
  assert.equal(isAllowedGoogleAccount("user@example.com", false, "user@example.com"), false);
  assert.equal(isAllowedGoogleAccount("user@example.com", true, undefined), false);
  assert.equal(isAllowedGoogleAccount("user@example.com.evil.test", true, "user@example.com"), false);
});

test("revocation targets only one active viewer row and rejects ambiguous records", () => {
  const rows = [["Email", "Peran"], ["Viewer@Example.com", "viewer"], ["other@example.com", "revoked"]];
  assert.equal(activeViewerRow(rows, "viewer@example.com"), 2);
  assert.equal(activeViewerRow(rows, "other@example.com"), null);
  assert.equal(activeViewerRow([...rows, ["viewer@example.com", "viewer"]], "viewer@example.com"), null);
});

test("viewer login requires verified exact email and does not grant administrator access", () => {
  const viewers = ["viewer@example.com"];
  assert.equal(isViewerAccount(" Viewer@Example.com ", true, viewers), true);
  assert.equal(isViewerAccount("viewer@example.com", false, viewers), false);
  assert.equal(isViewerAccount("viewer@example.com.evil.test", true, viewers), false);
  assert.equal(isAllowedGoogleAccount("viewer@example.com", true, "admin@example.com"), false);
});

test("managed administrator has distinct access and can be revoked", () => {
  const users = [{ email: "admin@example.com", role: "admin" as const }, { email: "operator@example.com", role: "operator" as const }];
  assert.equal(isManagedAdministrator(" ADMIN@example.com ", users), true);
  assert.equal(isManagedAdministrator("operator@example.com", users), false);
  assert.equal(activeViewerRow([["Email", "Peran"], ["admin@example.com", "admin"]], "admin@example.com"), 2);
  assert.equal(isAllowedGoogleAccount("owner@example.com", true, "owner@example.com,developer@example.com,admin@example.com"), true);
});
