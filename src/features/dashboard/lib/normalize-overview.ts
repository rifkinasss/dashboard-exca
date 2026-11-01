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

function parseSpkNumber(value: RawCell): ParsedCell<string> {
  if (missing(value)) return { state: "missing", value: null };
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return { state: "invalid", value: null };
  return { state: "valid", value: String(value).trim() };
}

function parseNotes(value: RawCell): ParsedCell<string> {
  if (missing(value)) return { state: "missing", value: null };
  return typeof value === "string" ? { state: "valid", value: value.trim() } : { state: "invalid", value: null };
}

export function normalizeOverview(rows: readonly RawOverviewRow[], options: ProcessingOptions = {}) {
  const firstDataRow = options.firstDataRow ?? 2;
  if (!Number.isSafeInteger(firstDataRow) || firstDataRow < 1) throw new RangeError("firstDataRow harus bilangan bulat positif.");
  const issues: DataQualityIssue[] = [];
  const mergedPlot = (rowNumber: number) => {
    const matches = (options.plotCodeMerges ?? []).filter((merge) => Number.isSafeInteger(merge.startRow) && Number.isSafeInteger(merge.endRow) && merge.startRow >= firstDataRow && merge.endRow >= merge.startRow && rowNumber >= merge.startRow && rowNumber <= merge.endRow);
    if (matches.length !== 1) return null;
    const merge = matches[0];
    const anchor = normalizePlotCode(rows[merge.startRow - firstDataRow]?.[2]);
    if (anchor.state !== "valid") return null;
    const start = merge.startRow - firstDataRow;
    const end = Math.min(merge.endRow - firstDataRow + 1, rows.length);
    if (rows.slice(start, end).some((row) => { const code = normalizePlotCode(row[2]); return code.state === "invalid" || (code.state === "valid" && code.value !== anchor.value); })) return null;
    return { code: anchor.value, row: merge.startRow };
  };
  const records = rows.map((raw, index): OverviewRecord => {
    const source = { worksheet: options.worksheetName ?? "Overview", row: firstDataRow + index };
    const spkRanges = (options.spkMerges ?? []).filter((merge) => Number.isSafeInteger(merge.startRow) && Number.isSafeInteger(merge.endRow) && merge.startRow >= firstDataRow && merge.endRow >= merge.startRow && source.row >= merge.startRow && source.row <= merge.endRow);
    const range = spkRanges[0];
    const anchor = range ? parseSpkNumber(rows[range.startRow - firstDataRow]?.[1]) : null;
    const ambiguous = spkRanges.length > 1 || Boolean(range && (anchor?.state !== "valid" || rows.slice(range.startRow - firstDataRow, range.endRow - firstDataRow + 1).some((row) => { const value = parseSpkNumber(row[1]); return value.state === "invalid" || (value.state === "valid" && value.value !== anchor?.value); })));
    const originalSpk = parseSpkNumber(raw[1]);
    const inheritedSpk = !ambiguous && range && anchor?.state === "valid" && originalSpk.state === "missing" ? { value: anchor.value, row: range.startRow } : null;
    const originalPlot = normalizePlotCode(raw[2]);
    const inheritedPlot = originalPlot.state === "missing" ? mergedPlot(source.row) : null;
    const cells = {
      no: parseOverviewNumber(raw[0], options.numberPolicy ?? "id-ID"),
      spkNumber: ambiguous ? { state: "invalid" as const, value: null } : inheritedSpk ? { state: "valid" as const, value: inheritedSpk.value } : originalSpk,
      plotCode: inheritedPlot ? { state: "valid" as const, value: inheritedPlot.code } : originalPlot,
      plotArea: parseOverviewNumber(raw[3], options.numberPolicy ?? "id-ID"),
      totalFuelConsumption: parseOverviewNumber(raw[4], options.numberPolicy ?? "id-ID"),
      date: parseOverviewDate(raw[5]),
      hmStart: parseOverviewNumber(raw[6], options.numberPolicy ?? "id-ID"),
      hmEnd: parseOverviewNumber(raw[7], options.numberPolicy ?? "id-ID"),
      workingHours: parseOverviewNumber(raw[8], options.numberPolicy ?? "id-ID"),
      estimatedWorkingHours: parseOverviewNumber(raw[9], options.numberPolicy ?? "id-ID"),
      fuelRefill: parseOverviewNumber(raw[10], options.numberPolicy ?? "id-ID"),
      fuelPerHour: parseOverviewNumber(raw[11], options.numberPolicy ?? "id-ID"),
      actualFuelUsage: parseOverviewNumber(raw[12], options.numberPolicy ?? "id-ID"),
      remainingFuel: parseOverviewNumber(raw[13], options.numberPolicy ?? "id-ID"),
      workStatus: normalizeWorkStatus(raw[14]),
      notes: parseNotes(raw[15]),
    };
    const cellStates = {} as Record<(typeof overviewColumns)[number]["field"], CellState>;
    for (const { field, header } of overviewColumns) {
      const { state } = cells[field];
      cellStates[field] = state;
      if (state === "valid" || (field === "spkNumber" && (state === "missing" || ambiguous))) continue;
      const identity = field === "date" || field === "plotCode";
      issues.push({ source, field, severity: identity ? "error" : state === "invalid" ? "warning" : "info",
        code: state === "missing" ? "missing_value" : "invalid_value",
        message: `${header}: ${state === "missing" ? "nilai belum tersedia" : "format tidak valid"}.` });
    }
    if (ambiguous) issues.push({ source, field: "spkNumber", severity: "warning", code: "metadata_conflict", message: "Nomor SPK pada rentang sel gabungan ambigu dan tidak digunakan.", relatedRows: spkRanges.map((merge) => merge.startRow) });
    else if (cells.spkNumber.state === "missing" && cells.plotCode.state === "valid") issues.push({ source, field: "spkNumber", severity: "warning", code: "missing_value", message: "Nomor SPK belum tersedia; aktivitas tidak dikaitkan dengan SPK lain." });
    if (raw.length > overviewColumns.length) issues.push({ source, field: null, severity: "warning", code: "column_count", message: "Kolom setelah P tidak dipakai; baris mentah tetap disimpan." });
    return {
      no: cells.no.value, spkNumber: cells.spkNumber.value, plotCode: cells.plotCode.value ?? "", plotArea: cells.plotArea.value,
      totalFuelConsumption: cells.totalFuelConsumption.value, date: cells.date.value,
      hmStart: cells.hmStart.value, hmEnd: cells.hmEnd.value, workingHours: cells.workingHours.value,
      estimatedWorkingHours: cells.estimatedWorkingHours.value, fuelRefill: cells.fuelRefill.value,
      fuelPerHour: cells.fuelPerHour.value, actualFuelUsage: cells.actualFuelUsage.value,
      remainingFuel: cells.remainingFuel.value, workStatus: cells.workStatus.value, notes: cells.notes.value,
      source, plotCodeSource: cells.plotCode.state === "valid" ? { worksheet: source.worksheet, row: inheritedPlot?.row ?? source.row } : null, spkSource: cells.spkNumber.state === "valid" ? { worksheet: source.worksheet, row: inheritedSpk?.row ?? source.row } : null, raw: [...raw], cellStates,
    };
  });
  return { records, issues };
}
