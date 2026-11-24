export type SheetPlot = { code: string; spk: string | null; pricePerHa: number | null; totalValue: number | null; area: number | null; totalFuelConsumption: number | null; sourceRow: number; spkSourceRow: number; areaSourceRow: number; activities: { sourceRow: number; date: string | null; hmStart: number | null; hmEnd: number | null; workingHours: number | null; estimatedWorkingHours: number | null; fuelRefill: number | null; fuelPerHour: number | null; actualFuelUsage: number | null; workStatus: string | null; notes: string | null }[] };

export type PlotSheetSummary = Pick<SheetPlot, "code" | "spk" | "pricePerHa" | "totalValue" | "area" | "totalFuelConsumption">;

export const plot2026Worksheet = "2026";
export const plot2026Period = { start: "2026-10-01", end: "2026-12-31" };

export function isPlot2026Date(date: string) {
  return date >= plot2026Period.start && date <= plot2026Period.end;
}

const text = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";

export function plotActivityTotalIndex(rows: readonly (readonly unknown[])[], headerIndex: number) {
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const label = text(rows[index]?.[0]);
    if (label === "Total") return index;
    if (label === "No. SPK" || label === "Kode Petak") return -1;
  }
  return -1;
}

export function plotActivityAverageIndex(rows: readonly (readonly unknown[])[], totalIndex: number) {
  for (let index = totalIndex + 1; index < rows.length; index++) {
    const label = text(rows[index]?.[0]);
    if (label === "Rata-Rata") return index;
    if (label === "No. SPK" || label === "Kode Petak") return -1;
  }
  return -1;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.trim().replaceAll(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function date(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim());
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

export function parsePlotSheet(values: readonly (readonly unknown[])[]): SheetPlot[] {
  const plots: SheetPlot[] = [];
  for (let index = 0; index < values.length; index++) {
    const hasSpk = text(values[index]?.[0]) === "No. SPK";
    if (!hasSpk && text(values[index - 1]?.[0]) === "No. SPK") continue;
    const codeIndex = index + Number(hasSpk);
    if (text(values[codeIndex]?.[0]) !== "Kode Petak") continue;
    if (text(values[codeIndex + 1]?.[0]) !== "Harga Petak / Ha" || text(values[codeIndex + 3]?.[0]) !== "Luas Petak") continue;
    const code = text(values[codeIndex]?.[2]);
    if (!code) continue;
    const activityHeaders = values[codeIndex + 6] ?? [];
    const validActivityTable = ["No", "Tanggal", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)"].every((header, column) => text(activityHeaders[column]) === header);
    const totalIndex = plotActivityTotalIndex(values, codeIndex + 6);
    const activityCount = totalIndex < 0 ? 6 : totalIndex - codeIndex - 7;
    const activities = validActivityTable ? Array.from({ length: activityCount }, (_, offset) => {
      const rowIndex = codeIndex + 7 + offset;
      const row = values[rowIndex] ?? [];
      if ([1, 2, 3, 6, 7, 10, 11].every((column) => row[column] === "" || row[column] == null)) return null;
      const rawStatus = text(row[10]);
      const workStatus = rawStatus === "Mulai Garap Petak" ? "Mulai pengerjaan" : rawStatus === "Garap Petak Berlangsung" ? "Dalam pengerjaan" : rawStatus === "Garap Petak Selesai" ? "Selesai" : rawStatus || null;
      return { sourceRow: rowIndex + 1, date: date(row[1]), hmStart: number(row[2]), hmEnd: number(row[3]), workingHours: number(row[4]), estimatedWorkingHours: number(row[5]), fuelRefill: number(row[6]), fuelPerHour: number(row[7]), actualFuelUsage: number(row[8]), workStatus, notes: text(row[11]) || null };
    }).filter((activity): activity is NonNullable<typeof activity> => activity !== null) : [];
    const valueRow = values[codeIndex + 2];
    const fuelRow = values[codeIndex + 4];
    plots.push({
      code,
      spk: hasSpk ? text(values[index]?.[2]) || null : null,
      pricePerHa: number(values[codeIndex + 1]?.[2]),
      totalValue: text(valueRow?.[0]) === "Total Nilai Petak" ? number(valueRow?.[2]) : null,
      area: number(values[codeIndex + 3]?.[2]),
      totalFuelConsumption: text(fuelRow?.[0]) === "Total Konsumsi Solar" ? number(fuelRow?.[2]) : null,
      sourceRow: codeIndex + 1,
      spkSourceRow: hasSpk ? index + 1 : codeIndex + 1,
      areaSourceRow: codeIndex + 4,
      activities,
    });
  }
  return plots;
}

export function plotSheetRange(sheet: string, range: string) {
  return `'${sheet.replaceAll("'", "''")}'!${range}`;
}

export const plotActivityHeaders = [
  "No", "Tanggal", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)",
  "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Sisa/Stok Tangki (L)", "Status Pekerjaan", "Keterangan",
];

export function plotActivityHeaderIndex(plotSourceRow: number) {
  return plotSourceRow + 5;
}

export function isPlotFinished(activities: SheetPlot["activities"]) {
  for (let index = activities.length - 1; index >= 0; index--) {
    if (activities[index].workStatus) return activities[index].workStatus === "Selesai";
  }
  return false;
}

export function toPlotSheetStatus(status: string) {
  const statuses: Record<string, string> = {
    "Mulai pengerjaan": "Mulai Garap Petak",
    "Dalam pengerjaan": "Garap Petak Berlangsung",
    Selesai: "Garap Petak Selesai",
  };
  return Object.hasOwn(statuses, status) ? statuses[status] : null;
}
