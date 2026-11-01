export type FinanceCell = string | number | boolean | null | undefined;
export type RawFinanceRow = readonly FinanceCell[];
export interface FinanceMerge { startRow: number; endRow: number; }
export const financeColumns = [
  "No", "No. SPK", "Kode Petak", "Luas Petak (Ha)", "Harga Petak / Ha", "Harga per Petak", "Harga Solar", "Pengisian Solar (L)", "Pengeluaran Solar", "Pendapatan Kotor", "Pendapatan Bersih",
] as const;
export interface FinanceRecord {
  row: number;
  worksheet: string;
  spk: string | null;
  plot: string | null;
  spkSourceRow: number | null;
  plotSourceRow: number | null;
  area: number | null;
  pricePerHa: number | null;
  pricePerPlot: number | null;
  fuelPrice: number | null;
  fuelRefill: number | null;
  fuelCost: number | null;
  grossValue: number | null;
  sourceNetValue: number | null;
  raw: RawFinanceRow;
}
export interface FinanceIssue { code: string; message: string; worksheet: string; row: number; relatedRows?: number[]; }
