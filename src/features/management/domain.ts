import type { WorkStatus } from "../dashboard/types";

type Id<Name extends string> = string & { readonly __entity: Name };
export type PlotId = Id<"PlotId">;
export type ActivityId = Id<"ActivityId">;
export type FuelRefillId = Id<"FuelRefillId">;
export type SpkId = Id<"SpkId">;
export type PlotSpkAssociationId = Id<"PlotSpkAssociationId">;

export interface SourceTrace { worksheet: string; row: number | null }

export interface PlotMaster {
  id: PlotId;
  code: string;
  areaHa: number | null;
  notes: string | null;
  source: SourceTrace;
  createdAt: string;
  updatedAt: string;
}

export interface WorkActivity {
  id: ActivityId;
  plotId: PlotId;
  plotSpkAssociationId: PlotSpkAssociationId | null;
  date: string | null;
  hmStart: number | null;
  hmEnd: number | null;
  workingHours: number | null;
  workStatus: WorkStatus | null;
  source: SourceTrace;
}

export interface FuelRefillTransaction {
  id: FuelRefillId;
  plotId: PlotId;
  plotSpkAssociationId: PlotSpkAssociationId | null;
  activityId: ActivityId | null;
  refilledAt: string | null;
  liters: number | null;
  source: SourceTrace;
}

export type SpkAdministrationStatus = "available" | "submitted" | "approved" | "rejected";

export interface SpkDocument {
  id: SpkId;
  number: string;
  administrationStatus: SpkAdministrationStatus;
  documentReference: string | null;
  source: SourceTrace;
  createdAt: string;
  updatedAt: string;
}

export type PlotSpkAssociation =
  | { id: PlotSpkAssociationId; plotId: PlotId; spkId: null; state: "pending"; effectiveFrom: string | null; effectiveTo: string | null; source: SourceTrace }
  | { id: PlotSpkAssociationId; plotId: PlotId; spkId: SpkId; state: "linked"; effectiveFrom: string | null; effectiveTo: string | null; source: SourceTrace };

export interface PlotDraft {
  code: string;
  areaHa: number | null;
  notes: string | null;
  spkAvailability: "unavailable" | "available";
  spkNumber: string;
}

export type PlotDraftError = "plot_code_required" | "duplicate_plot_code" | "area_invalid" | "spk_required" | "spk_not_found";

export type PlotCreationResult =
  | { ok: true; plot: Omit<PlotMaster, "createdAt" | "updatedAt">; association: PlotSpkAssociation }
  | { ok: false; errors: PlotDraftError[] };

export function preparePlotCreation(
  draft: PlotDraft,
  ids: { plotId: PlotId; associationId: PlotSpkAssociationId },
  existingPlots: readonly PlotMaster[],
  spks: readonly SpkDocument[],
  effectiveFrom: string | null = null,
): PlotCreationResult {
  const code = draft.code.trim().toUpperCase();
  const spkNumber = draft.spkNumber.trim();
  const errors: PlotDraftError[] = [];
  if (!code) errors.push("plot_code_required");
  if (existingPlots.some((plot) => plot.code.trim().toUpperCase() === code)) errors.push("duplicate_plot_code");
  if (draft.areaHa !== null && (!Number.isFinite(draft.areaHa) || draft.areaHa <= 0)) errors.push("area_invalid");
  const spk = draft.spkAvailability === "available" ? spks.find((item) => item.number === spkNumber) : undefined;
  if (draft.spkAvailability === "available" && !spkNumber) errors.push("spk_required");
  else if (draft.spkAvailability === "available" && !spk) errors.push("spk_not_found");
  if (errors.length) return { ok: false, errors };
  const plot: Omit<PlotMaster, "createdAt" | "updatedAt"> = {
    id: ids.plotId,
    code,
    areaHa: draft.areaHa,
    notes: draft.notes?.trim() || null,
    source: { worksheet: "management", row: null },
  };
  const association: PlotSpkAssociation = spk
    ? { id: ids.associationId, plotId: ids.plotId, spkId: spk.id, state: "linked", effectiveFrom, effectiveTo: null, source: { worksheet: "management", row: null } }
    : { id: ids.associationId, plotId: ids.plotId, spkId: null, state: "pending", effectiveFrom, effectiveTo: null, source: { worksheet: "management", row: null } };
  return { ok: true, plot, association };
}

export function linkPendingSpk(association: PlotSpkAssociation, spk: SpkDocument): PlotSpkAssociation | null {
  if (association.state !== "pending") return null;
  return { ...association, state: "linked", spkId: spk.id };
}

export function attachActivitiesToAssociation(
  activities: readonly WorkActivity[],
  activityIds: readonly ActivityId[],
  association: PlotSpkAssociation,
): WorkActivity[] | null {
  const selected = new Set(activityIds);
  if (association.state !== "linked" || selected.size !== activityIds.length || activities.filter((activity) => selected.has(activity.id)).length !== selected.size || activities.some((activity) => selected.has(activity.id) && (activity.plotId !== association.plotId || (activity.plotSpkAssociationId !== null && activity.plotSpkAssociationId !== association.id)))) return null;
  return activities.map((activity) => selected.has(activity.id) ? { ...activity, plotSpkAssociationId: association.id } : activity);
}
