import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachActivitiesToAssociation,
  linkPendingSpk,
  preparePlotCreation,
  type ActivityId,
  type PlotDraft,
  type PlotId,
  type PlotMaster,
  type PlotSpkAssociation,
  type PlotSpkAssociationId,
  type SpkDocument,
  type SpkId,
  type WorkActivity,
} from "../../management/domain";

const plotId = (value: string) => value as PlotId;
const spkId = (value: string) => value as SpkId;
const associationId = (value: string) => value as PlotSpkAssociationId;
const activityId = (value: string) => value as ActivityId;
const draft = (overrides: Partial<PlotDraft> = {}): PlotDraft => ({ code: " 72a1/j54 ", areaHa: null, notes: null, spkAvailability: "unavailable", spkNumber: "", ...overrides });
const spk = (id: string, number: string): SpkDocument => ({ id: spkId(id), number, administrationStatus: "available", documentReference: null, source: { worksheet: "management", row: null }, createdAt: "2026-11-01", updatedAt: "2026-11-01" });
const plot = (id: string, code: string): PlotMaster => ({ id: plotId(id), code, areaHa: null, notes: null, source: { worksheet: "management", row: null }, createdAt: "2026-11-01", updatedAt: "2026-11-01" });
const activity = (id: string, pId: PlotId, association: PlotSpkAssociationId | null, status: WorkActivity["workStatus"] = "Dalam pengerjaan"): WorkActivity => ({ id: activityId(id), plotId: pId, plotSpkAssociationId: association, date: "2026-11-01", hmStart: 10, hmEnd: 12, workingHours: 2, workStatus: status, source: { worksheet: "Overview Operasional", row: 12 } });
const pending = (pId: PlotId, id = "association-1"): PlotSpkAssociation => ({ id: associationId(id), plotId: pId, spkId: null, state: "pending", effectiveFrom: null, effectiveTo: null, source: { worksheet: "management", row: null } });
const expectSuccess = (result: ReturnType<typeof preparePlotCreation>) => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected valid plot draft");
  return result;
};

test("plot creation accepts no area and no SPK while creating an independent pending administration link", () => {
  const result = expectSuccess(preparePlotCreation(draft(), { plotId: plotId("plot-1"), associationId: associationId("assoc-1") }, [], []));
  assert.equal(result.plot.id, "plot-1");
  assert.equal(result.plot.code, "72A1/J54");
  assert.equal(result.plot.areaHa, null);
  assert.equal(result.association.state, "pending");
  assert.equal(result.association.spkId, null);
});

test("pending plot association can be linked later without changing or duplicating historical activity and financial values", () => {
  const relation = pending(plotId("plot-1"));
  const activities = [activity("activity-1", relation.plotId, relation.id, "Selesai")];
  const financialValues = [{ id: "finance-1", gross: 125000, fuelCost: 30000 }];
  const linked = linkPendingSpk(relation, spk("spk-1", "0005123"));
  assert.equal(linked?.id, relation.id);
  assert.equal(linked?.spkId, "spk-1");
  assert.equal(linked?.state, "linked");
  assert.equal(activities.length, 1);
  assert.equal(activities[0].workStatus, "Selesai");
  assert.equal(activities[0].plotSpkAssociationId, relation.id);
  assert.equal(financialValues.length, 1);
  assert.equal(financialValues[0].gross, 125000);
  assert.equal(relation.state, "pending");
});

test("a single SPK document can be linked to more than one plot", () => {
  const document = spk("spk-shared", "0005123");
  const first = expectSuccess(preparePlotCreation(draft({ code: "PLOT-A", spkAvailability: "available", spkNumber: document.number }), { plotId: plotId("plot-a"), associationId: associationId("assoc-a") }, [], [document]));
  const second = expectSuccess(preparePlotCreation(draft({ code: "PLOT-B", spkAvailability: "available", spkNumber: document.number }), { plotId: plotId("plot-b"), associationId: associationId("assoc-b") }, [], [document]));
  assert.equal(first.association.spkId, document.id);
  assert.equal(second.association.spkId, document.id);
  assert.notEqual(first.association.id, second.association.id);
});

test("work completion and fuel/HM records do not require an SPK", () => {
  const result = expectSuccess(preparePlotCreation(draft({ code: "PLOT-C" }), { plotId: plotId("plot-c"), associationId: associationId("assoc-c") }, [], []));
  const completed = activity("activity-c", result.plot.id, result.association.id, "Selesai");
  const refill = { id: "refill-c", plotId: result.plot.id, plotSpkAssociationId: null, activityId: completed.id, refilledAt: "2026-11-01", liters: 100 };
  assert.equal(result.association.state, "pending");
  assert.equal(completed.workStatus, "Selesai");
  assert.equal(completed.workingHours, 2);
  assert.equal(refill.plotSpkAssociationId, null);
  assert.equal(refill.liters, 100);
});

test("repeated work on one plot under different SPKs uses distinct associations without duplicating plot or activities", () => {
  const pId = plotId("plot-repeated");
  const firstSpk = spk("spk-oct", "SPK-10");
  const secondSpk = spk("spk-nov", "SPK-11");
  const first = expectSuccess(preparePlotCreation(draft({ code: "PLOT-R", spkAvailability: "available", spkNumber: firstSpk.number }), { plotId: pId, associationId: associationId("assoc-oct") }, [], [firstSpk]));
  const second: PlotSpkAssociation = { id: associationId("assoc-nov"), plotId: pId, spkId: secondSpk.id, state: "linked", effectiveFrom: "2026-11-01", effectiveTo: null, source: { worksheet: "management", row: null } };
  const activities = [activity("oct-work", pId, first.association.id), activity("nov-work", pId, second.id)];
  assert.equal(first.plot.id, second.plotId);
  assert.deepEqual(activities.map((entry) => entry.plotSpkAssociationId), [first.association.id, second.id]);
  assert.equal(new Set(activities.map((entry) => entry.id)).size, 2);
});

test("duplicate plot codes are rejected case-insensitively and missing area remains valid", () => {
  const duplicate = preparePlotCreation(draft({ code: "72A1/J54" }), { plotId: plotId("plot-new"), associationId: associationId("assoc-new") }, [plot("plot-existing", "72a1/j54")], []);
  const missingArea = preparePlotCreation(draft({ code: "PLOT-NEW", areaHa: null }), { plotId: plotId("plot-new"), associationId: associationId("assoc-new") }, [], []);
  assert.equal(duplicate.ok, false);
  if (duplicate.ok) throw new Error("Duplicate plot must be rejected");
  assert.ok(duplicate.errors.includes("duplicate_plot_code"));
  const validMissingArea = expectSuccess(missingArea);
  assert.equal(validMissingArea.plot.areaHa, null);
});

test("SPK is kept as text and old activities can be explicitly linked in place", () => {
  const existingSpk = spk("spk-leading-zero", "0000012345");
  const plotIdValue = plotId("plot-old");
  const result = expectSuccess(preparePlotCreation(draft({ code: "PLOT-OLD", spkAvailability: "available", spkNumber: "0000012345" }), { plotId: plotIdValue, associationId: associationId("assoc-old") }, [], [existingSpk]));
  const original = [activity("old-activity", plotIdValue, null, "Selesai")];
  const linkedActivities = attachActivitiesToAssociation(original, [original[0].id], result.association);
  assert.equal(existingSpk.number, "0000012345");
  assert.equal(linkedActivities?.length, 1);
  assert.equal(linkedActivities?.[0].id, original[0].id);
  assert.equal(linkedActivities?.[0].workingHours, original[0].workingHours);
  assert.equal(linkedActivities?.[0].workStatus, "Selesai");
  assert.equal(original[0].plotSpkAssociationId, null);
});

test("activity association rejects cross-plot links and refuses implicit reassignment", () => {
  const relation = { ...pending(plotId("plot-a")), state: "linked" as const, spkId: spkId("spk-a") };
  assert.equal(attachActivitiesToAssociation([activity("activity-b", plotId("plot-b"), null)], [activityId("activity-b")], relation), null);
  const alreadyLinked = activity("activity-a", plotId("plot-a"), associationId("assoc-other"));
  assert.equal(attachActivitiesToAssociation([alreadyLinked], [alreadyLinked.id], relation), null);
});
