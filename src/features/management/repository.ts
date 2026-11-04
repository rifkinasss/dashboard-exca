import type { FuelRefillTransaction, PlotMaster, PlotSpkAssociation, SpkDocument, WorkActivity } from "./domain";

/** Interfaces only: the app currently exposes no management mutation implementation. */
export interface ReadRepository<Entity> {
  list(): Promise<readonly Entity[]>;
  get(id: string): Promise<Entity | null>;
}

export interface CreateRepository<Entity, CreateInput> {
  create(input: CreateInput): Promise<Entity>;
}

export interface UpdateRepository<Entity, UpdateInput> {
  update(id: string, input: UpdateInput, version: string): Promise<Entity>;
}

export interface ArchiveRepository {
  archive(id: string, version: string): Promise<void>;
}

/** Compose only after identity, auth, concurrency and audit contracts are approved. */
export interface ManagementRepository<Entity, CreateInput, UpdateInput>
  extends ReadRepository<Entity>, CreateRepository<Entity, CreateInput>, UpdateRepository<Entity, UpdateInput>, ArchiveRepository {}

export type PlotRepository = ManagementRepository<PlotMaster, Pick<PlotMaster, "code" | "areaHa" | "notes">, Partial<Pick<PlotMaster, "code" | "areaHa" | "notes">>>;
export type ActivityRepository = ManagementRepository<WorkActivity, Omit<WorkActivity, "id" | "source">, Partial<Omit<WorkActivity, "id" | "plotId" | "source">>>;
export type FuelRefillRepository = ManagementRepository<FuelRefillTransaction, Omit<FuelRefillTransaction, "id" | "source">, Partial<Omit<FuelRefillTransaction, "id" | "plotId" | "source">>>;
export type SpkDocumentRepository = ManagementRepository<SpkDocument, Omit<SpkDocument, "id" | "source" | "createdAt" | "updatedAt">, Partial<Pick<SpkDocument, "administrationStatus" | "documentReference">>>;
export type PlotSpkAssociationRepository = ManagementRepository<PlotSpkAssociation, Omit<PlotSpkAssociation, "id" | "source">, Partial<Pick<PlotSpkAssociation, "effectiveFrom" | "effectiveTo">>>;
