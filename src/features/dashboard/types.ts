export const workStatuses = ["Belum mulai", "Mulai pengerjaan", "Dalam pengerjaan", "Selesai", "Ditunda"] as const;
export type WorkStatus = (typeof workStatuses)[number];
export type RawCell = string | number | boolean | null | undefined;
export type RawOverviewRow = readonly RawCell[];
export type CellState = "valid" | "missing" | "invalid";

export interface PlotCodeMerge { startRow: number; endRow: number; }

export interface SourceRow {
  worksheet: string;
  row: number;
}

/** Overview columns A–P. Dates are local calendar dates, never timestamps. */
export interface OverviewRecord {
  no: number | null;
  spkNumber: string | null;
  plotCode: string;
  plotArea: number | null;
  totalFuelConsumption: number | null;
  date: string | null;
  hmStart: number | null;
  hmEnd: number | null;
  workingHours: number | null;
  estimatedWorkingHours: number | null;
  fuelRefill: number | null;
  fuelPerHour: number | null;
  actualFuelUsage: number | null;
  remainingFuel: number | null;
  workStatus: WorkStatus | null;
  notes: string | null;
  source: SourceRow;
  plotCodeSource: SourceRow | null;
  spkSource: SourceRow | null;
  raw: RawOverviewRow;
  cellStates: Record<OverviewField, CellState>;
}

export const overviewColumns = [
  { column: "A", header: "No", field: "no" },
  { column: "B", header: "No. SPK", field: "spkNumber" },
  { column: "C", header: "Kode Petak", field: "plotCode" },
  { column: "D", header: "Luas Petak (Ha)", field: "plotArea" },
  { column: "E", header: "Total Konsumsi Solar", field: "totalFuelConsumption" },
  { column: "F", header: "Tanggal", field: "date" },
  { column: "G", header: "HM Awal", field: "hmStart" },
  { column: "H", header: "HM Akhir", field: "hmEnd" },
  { column: "I", header: "HM Kerja (Jam)", field: "workingHours" },
  { column: "J", header: "Est. Jam Kerja", field: "estimatedWorkingHours" },
  { column: "K", header: "Pengisian Solar (L)", field: "fuelRefill" },
  { column: "L", header: "Pemakaian Solar per Jam (L/Hr)", field: "fuelPerHour" },
  { column: "M", header: "Pemakaian Solar Riil (L)", field: "actualFuelUsage" },
  { column: "N", header: "Sisa/Stok Tangki (L)", field: "remainingFuel" },
  { column: "O", header: "Status Pekerjaan", field: "workStatus" },
  { column: "P", header: "Keterangan", field: "notes" },
] as const;

export type OverviewField = (typeof overviewColumns)[number]["field"];
export type NumericField = Exclude<OverviewField, "spkNumber" | "plotCode" | "date" | "workStatus" | "notes">;
export type NumberPolicy = "id-ID" | "strict";
export interface ProcessingOptions {
  worksheetName?: string;
  numberPolicy?: NumberPolicy;
  firstDataRow?: number;
  sheetOrderConfirmed?: boolean;
  plotCodeMerges?: readonly PlotCodeMerge[];
  spkMerges?: readonly PlotCodeMerge[];
}
export interface DataQualityIssue {
  severity: "info" | "warning" | "error";
  code: "missing_value" | "invalid_value" | "negative_value" | "hm_reversed" |
    "hm_mismatch" | "area_conflict" | "zero_area" | "metadata_conflict" | "metadata_unassigned" | "undated_plot" | "completion_area_excluded" | "status_conflict" | "duplicate_record" | "unpaired_measurements" | "column_count";
  source: SourceRow;
  field: OverviewField | null;
  message: string;
  relatedRows?: number[];
}
export interface ValidatedOverviewRecord {
  record: OverviewRecord;
  invalidFields: OverviewField[];
  efficiencyEligible: boolean;
  duplicateOf: number | null;
}
export interface DashboardFilters {
  startDate: string;
  endDate: string;
  plotCodes: string[];
  selectedSpkNumbers: string[];
  statuses: WorkStatus[];
}
export interface PlotSummary {
  code: string;
  area: number | null;
  areaRequiresReview: boolean;
  fuel: number | null;
  hours: number | null;
  efficiency: number | null;
  status: WorkStatus | null;
  statusAmbiguous: boolean;
}
export interface PlotMetadata {
  value: number | null;
  sourceRows: SourceRow[];
  requiresReview: boolean;
}
export interface InventoryPlot extends PlotSummary {
  areaMetadata: PlotMetadata;
  cumulativeFuelMetadata: PlotMetadata;
  hasActivity: boolean;
  includedActivity: boolean;
}
export interface DailyFuelTrend {
  date: string;
  fuel: number | null;
  byPlot: Record<string, number | null>;
}
export interface DashboardSummary {
  plots: PlotSummary[];
  daily: DailyFuelTrend[];
  totals: {
    plotCount: number;
    area: number | null;
    refill: number | null;
    fuel: number | null;
    hours: number | null;
    efficiency: number | null;
  };
  statuses: { status: WorkStatus | "Belum diketahui" | "Perlu tinjau"; count: number }[];
  missingMeasurements: number;
}
