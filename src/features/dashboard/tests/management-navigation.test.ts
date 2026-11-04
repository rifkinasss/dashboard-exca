import assert from "node:assert/strict";
import { test } from "node:test";
import { managementHref, managementNavigation } from "../../management/navigation";

test("management navigation exposes implemented dashboards and data modules", () => {
  const dashboard = managementNavigation[0].items[0];
  assert.ok("children" in dashboard);
  assert.deepEqual(dashboard.children.map((item) => item.label), ["Operasional", "Keuangan"]);
  const items = managementNavigation.flatMap((group) => group.items.flatMap((item) => "children" in item ? [...item.children] : [item]));
  assert.deepEqual(items.map((item) => item.href), ["/dashboard/operasional", "/dashboard/keuangan", "/petak", "/aktivitas", "/solar", "/keuangan", "/pengaturan"]);
  assert.equal(items.find((item) => item.href === "/petak")?.label, "Petak Lahan");
  assert.ok(items.every((item) => !item.planned));
  assert.equal(items.find((item) => item.href === "/solar")?.label, "Pembelian Solar");
  assert.equal(managementHref("/dashboard/keuangan", "start=2026-10-01&spk=A&spk=B&status=Selesai"), "/dashboard/keuangan?start=2026-10-01&spk=A&spk=B");
  assert.equal(managementHref("/petak", "spk=A"), "/petak");
});
