import { validDate } from "../../dashboard/lib/normalize-overview";
import { parsePlotMeasurement } from "./plot-measurement";
import { isPlot2026Date, plot2026Worksheet, toPlotSheetStatus, type SheetPlot } from "./plot-sheet";

export type PlotActivity = SheetPlot["activities"][number];
export const activityEditColumns = {
  date: 1, hmStart: 2, hmEnd: 3, workingHours: 4, estimatedWorkingHours: 5,
  fuelRefill: 6, fuelPerHour: 7, workStatus: 10, notes: 11,
} as const;
export type ActivityEditField = keyof typeof activityEditColumns;
export type ActivityEditDraft = Record<ActivityEditField, string>;

export function activityEditDraft(activity: PlotActivity): ActivityEditDraft {
  const value = (number: number | null) => number === null ? "" : String(number).replace(".", ",");
  return {
    date: activity.date ?? "",
    hmStart: value(activity.hmStart),
    hmEnd: value(activity.hmEnd),
    workingHours: value(activity.workingHours),
    estimatedWorkingHours: value(activity.estimatedWorkingHours),
    fuelRefill: value(activity.fuelRefill),
    fuelPerHour: value(activity.fuelPerHour),
    workStatus: activity.workStatus ?? "",
    notes: activity.notes ?? "",
  };
}

export function latestDatedPlotActivity<T extends { date: string | null; sourceRow: number }>(activities: readonly T[]): T | null {
  return activities.reduce<T | null>((latest, activity) => {
    if (!validDate(activity.date)) return latest;
    if (!latest || activity.date > latest.date! || (activity.date === latest.date && activity.sourceRow > latest.sourceRow)) return activity;
    return latest;
  }, null);
}

export function planActivityEdit(activity: PlotActivity, draft: ActivityEditDraft, worksheet: string) {
  const seed = activityEditDraft(activity);
  const cells: { column: number; value: string | number | null; formula?: string }[] = [];
  const row = activity.sourceRow;
  const changed = (key: ActivityEditField) => draft[key].trim() !== seed[key];
  const put = (key: ActivityEditField, value: string | number | null, formula?: string) => {
    cells.push({ column: activityEditColumns[key], value, formula });
  };

  if (changed("date")) {
    const date = draft.date.trim();
    if (!validDate(date) || (worksheet === plot2026Worksheet && !isPlot2026Date(date))) {
      return { error: worksheet === plot2026Worksheet ? "Tanggal aktivitas harus antara 1 Oktober dan 31 Desember 2026." : "Tanggal aktivitas tidak valid." };
    }
    put("date", Date.parse(`${date}T00:00:00Z`) / 86400000 + 25569);
  }
  if (changed("workStatus")) {
    const status = draft.workStatus.trim();
    const value = status ? toPlotSheetStatus(status) : null;
    if (status && !value) return { error: "Status pekerjaan tidak valid." };
    if (status === "Selesai" && !validDate(draft.date.trim())) return { error: "Isi tanggal aktivitas sebelum menandai petak selesai." };
    put("workStatus", value);
  }
  if (changed("notes")) put("notes", draft.notes.trim().slice(0, 1000) || null);

  const numbers = { hmStart: activity.hmStart, hmEnd: activity.hmEnd, workingHours: activity.workingHours };
  for (const key of ["hmStart", "hmEnd", "workingHours", "estimatedWorkingHours", "fuelRefill", "fuelPerHour"] as const) {
    if (!changed(key)) continue;
    const parsed = parsePlotMeasurement(draft[key]);
    if (parsed.state === "invalid" || (parsed.value !== null && parsed.value < 0)) return { error: "HM dan volume solar harus berupa angka nonnegatif." };
    if (key in numbers) numbers[key as keyof typeof numbers] = parsed.value;
    const formula = parsed.value !== null ? undefined
      : key === "workingHours" ? `=IF(OR(C${row}="";D${row}="");"";D${row}-C${row})`
      : key === "estimatedWorkingHours" ? `=IF(E${row}="";"";ROUND(E${row}))` : undefined;
    put(key, parsed.value, formula);
  }

  if (changed("hmStart") || changed("hmEnd") || changed("workingHours")) {
    const { hmStart, hmEnd, workingHours } = numbers;
    if (hmStart !== null && hmEnd !== null) {
      if (hmEnd < hmStart) return { error: "HM akhir tidak boleh lebih kecil dari HM awal." };
      if (changed("workingHours") && workingHours !== null && Math.abs(hmEnd - hmStart - workingHours) > 1e-6) {
        return { error: "HM kerja harus sesuai selisih HM akhir dan HM awal." };
      }
    }
  }
  return { cells };
}
