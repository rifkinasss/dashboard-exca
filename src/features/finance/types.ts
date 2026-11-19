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

export const allOverviewColumns = ["No", "No. SPK", "Dokumen SPK", "No. Berita Acara", "Dokumen Berita Acara", "No. Pencairan", "Bukti Pencairan", "Kode Petak", "Luas Petak (Ha)", "Harga Per Hektar", "Total Harga Per Petak", "Total Harga Setelah Pajak", "Total Konsumsi Solar", "Tanggal", "Pembelian Solar ( L )", "Harga Solar", "Total Harga Solar", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)", "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Status Pekerjaan", "Keterangan"] as const;

export const allOverviewWorksheet = "All Overview";

export function financeWorksheetName(value: string | undefined) {
  const name = value?.trim();
  return name === "Version 3.0 testing" || name === "Version 3.0 - testing" ? allOverviewWorksheet : name || "Overview Finance";
}
