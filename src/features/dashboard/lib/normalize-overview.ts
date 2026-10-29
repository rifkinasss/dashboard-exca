import { isValid, parseISO } from "date-fns";
import {
  overviewColumns, workStatuses, type CellState, type DataQualityIssue,
  type NumberPolicy, type OverviewRecord, type ProcessingOptions, type RawCell, type RawOverviewRow,
} from "../types";

export type ParsedCell<T> = { state: "valid"; value: T } | { state: "missing" | "invalid"; value: null };
const missing = (value: RawCell) => value === null || value === undefined || (typeof value === "string" && value.trim() === "");

export function parseOverviewNumber(value: RawCell, policy: NumberPolicy = "strict"): ParsedCell<number> {
  if (missing(value)) return { state: "missing", value: null };
  if (typeof value === "number") return Number.isFinite(value) ? { state: "valid", value } : { state: "invalid", value: null };
  if (typeof value !== "string") return { state: "invalid", value: null };
  const text = value.trim();
  const decimal = /^-?\d+(?:,\d+)?$/;
  const grouped = /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
  const explicitGrouping = grouped.test(text) && (policy === "id-ID" || text.includes(",") || (text.match(/\./g)?.length ?? 0) > 1);
  if (!decimal.test(text) && !explicitGrouping) return { state: "invalid", value: null };
  const number = Number(text.replaceAll(".", "").replace(",", "."));
  return Number.isFinite(number) ? { state: "valid", value: number } : { state: "invalid", value: null };
}

export const validDate = (value: string | null): value is string =>
  value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));

const months = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
export function parseOverviewDate(value: RawCell): ParsedCell<string> {
  if (missing(value)) return { state: "missing", value: null };
  if (typeof value !== "string") return { state: "invalid", value: null };
  const text = value.trim().toLowerCase();
  let canonical = text;
  const local = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(text);
  const named = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/.exec(text);
  if (local) canonical = `${local[4]}-${local[3].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  if (named) canonical = `${named[3]}-${String(months.indexOf(named[2]) + 1).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  return validDate(canonical) ? { state: "valid", value: canonical } : { state: "invalid", value: null };
}

export function normalizePlotCode(value: RawCell): ParsedCell<string> {
  if (missing(value)) return { state: "missing", value: null };
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return { state: "invalid", value: null };
  return { state: "valid", value: String(value).trim().toUpperCase() };
}

export function normalizeWorkStatus(value: RawCell): ParsedCell<NonNullable<OverviewRecord["workStatus"]>> {
  if (missing(value)) return { state: "missing", value: null };
  if (typeof value !== "string") return { state: "invalid", value: null };
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  const aliases: Record<string, NonNullable<OverviewRecord["workStatus"]>> = {
    "mulai garap petak": "Mulai pengerjaan",
    "garap petak berlangsung": "Dalam pengerjaan",
    "garap petak selesai": "Selesai",
  };
  const status = aliases[normalized] ?? workStatuses.find((status) => status.toLowerCase() === normalized);
  return status ? { state: "valid", value: status } : { state: "invalid", value: null };
}

function parseNotes(value: RawCell): ParsedCell<string> {
  if (missing(value)) return { state: "missing", value: null };
  return typeof value === "string" ? { state: "valid", value: value.trim() } : { state: "invalid", value: null };
}

export function normalizeOverview(rows: readonly RawOverviewRow[], options: ProcessingOptions = {}) {
  const firstDataRow = options.firstDataRow ?? 2;
  if (!Number.isSafeInteger(firstDataRow) || firstDataRow < 1) throw new RangeError("firstDataRow harus bilangan bulat positif.");
  const issues: DataQualityIssue[] = [];
  const records = rows.map((raw, index): OverviewRecord => {
    const source = { worksheet: options.worksheetName ?? "Overview", row: firstDataRow + index };
    const cells = {
      no: parseOverviewNumber(raw[0], options.numberPolicy ?? "id-ID"),
      plotCode: normalizePlotCode(raw[1]),
      plotArea: parseOverviewNumber(raw[2], options.numberPolicy ?? "id-ID"),
      totalFuelConsumption: parseOverviewNumber(raw[3], options.numberPolicy ?? "id-ID"),
      date: parseOverviewDate(raw[4]),
      hmStart: parseOverviewNumber(raw[5], options.numberPolicy ?? "id-ID"),
      hmEnd: parseOverviewNumber(raw[6], options.numberPolicy ?? "id-ID"),
      workingHours: parseOverviewNumber(raw[7], options.numberPolicy ?? "id-ID"),
      estimatedWorkingHours: parseOverviewNumber(raw[8], options.numberPolicy ?? "id-ID"),
      fuelRefill: parseOverviewNumber(raw[9], options.numberPolicy ?? "id-ID"),
      fuelPerHour: parseOverviewNumber(raw[10], options.numberPolicy ?? "id-ID"),
      actualFuelUsage: parseOverviewNumber(raw[11], options.numberPolicy ?? "id-ID"),
      remainingFuel: parseOverviewNumber(raw[12], options.numberPolicy ?? "id-ID"),
      workStatus: normalizeWorkStatus(raw[13]),
      notes: parseNotes(raw[14]),
    };
    const cellStates = {} as Record<(typeof overviewColumns)[number]["field"], CellState>;
    for (const { field, header } of overviewColumns) {
      const { state } = cells[field];
      cellStates[field] = state;
      if (state === "valid") continue;
      const identity = field === "date" || field === "plotCode";
      issues.push({ source, field, severity: identity ? "error" : state === "invalid" ? "warning" : "info",
        code: state === "missing" ? "missing_value" : "invalid_value",
        message: `${header}: ${state === "missing" ? "nilai belum tersedia" : "format tidak valid"}.` });
    }
    if (raw.length > 15) issues.push({ source, field: null, severity: "warning", code: "column_count", message: "Kolom setelah O tidak dipakai; baris mentah tetap disimpan." });
    return {
      no: cells.no.value, plotCode: cells.plotCode.value ?? "", plotArea: cells.plotArea.value,
      totalFuelConsumption: cells.totalFuelConsumption.value, date: cells.date.value,
      hmStart: cells.hmStart.value, hmEnd: cells.hmEnd.value, workingHours: cells.workingHours.value,
      estimatedWorkingHours: cells.estimatedWorkingHours.value, fuelRefill: cells.fuelRefill.value,
      fuelPerHour: cells.fuelPerHour.value, actualFuelUsage: cells.actualFuelUsage.value,
      remainingFuel: cells.remainingFuel.value, workStatus: cells.workStatus.value, notes: cells.notes.value,
      source, raw: [...raw], cellStates,
    };
  });
  return { records, issues };
}
