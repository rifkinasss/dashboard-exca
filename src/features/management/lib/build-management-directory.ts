import { buildDashboardViewModel } from "../../dashboard/lib/build-dashboard-view-model";
import { defaultFilters } from "../../dashboard/lib/overview";
import { validDate } from "../../dashboard/lib/normalize-overview";
import { calculateKpis } from "../../dashboard/lib/calculate-kpis";
import type { RawOverviewRow } from "../../dashboard/types";
import { buildFinanceView } from "../../finance/lib/build-finance-view";
import type { RawFinanceRow } from "../../finance/types";
import { derivePlotState, legacyPlotRouteId } from "./plot-state";

const allDates = { ...defaultFilters, startDate: "", endDate: "" };

export function buildManagementDirectory(
  operationRows: readonly RawOverviewRow[],
  financeRows: readonly RawFinanceRow[] = [],
  options: { operationWorksheet?: string; operationSpkMerges?: { startRow: number; endRow: number }[]; operationPlotMerges?: { startRow: number; endRow: number }[]; financeSpkMerges?: { startRow: number; endRow: number }[]; financePlotMerges?: { startRow: number; endRow: number }[]; financeAvailable?: boolean } = {},
) {
  const view = buildDashboardViewModel(operationRows, allDates, {
    worksheetName: options.operationWorksheet,
    spkMerges: options.operationSpkMerges,
    plotCodeMerges: options.operationPlotMerges,
  });
  const recordsByRow = new Map(view.records.map((record) => [record.source.row, record]));
  const validatedByRow = new Map(view.validatedRecords.map((record) => [record.record.source.row, record]));
  const issuesByRow = new Map<number, typeof view.issues>();
  for (const issue of view.issues) issuesByRow.set(issue.source.row, [...(issuesByRow.get(issue.source.row) ?? []), issue]);

  const plots = view.inventory.map((plot) => {
    const rows = view.validatedRecords.filter(({ record }) => record.plotCode === plot.code);
    const accepted = rows.filter((row) => row.duplicateOf === null);
    const state = derivePlotState(rows);
    const spks = [...new Set(accepted.map(({ record }) => record.spkNumber).filter((value): value is string => value !== null))].sort();
    const issues = view.issues.filter((issue) => {
      const sourceRecord = recordsByRow.get(issue.source.row);
      return sourceRecord?.plotCode === plot.code || issue.relatedRows?.some((row) => recordsByRow.get(row)?.plotCode === plot.code);
    });
    return {
      id: legacyPlotRouteId(plot.code),
      code: plot.code,
      spks,
      spkAssociations: [...Map.groupBy(rows.filter(({ record }) => record.spkNumber !== null), ({ record }) => record.spkNumber!)].map(([number, associatedRows]) => ({
        number,
        sourceRows: [...new Set(associatedRows.map(({ record }) => record.spkSource?.row ?? record.source.row))].sort((a, b) => a - b),
      })),
      spkSourceRows: [...new Set(rows.flatMap(({ record }) => record.spkNumber === null ? [] : [record.spkSource?.row ?? record.source.row]))],
      plotCodeSourceRows: [...new Set(rows.map(({ record }) => record.plotCodeSource?.row ?? record.source.row))],
      area: plot.area,
      areaRequiresReview: plot.areaRequiresReview,
      status: plot.status,
      statusAmbiguous: plot.statusAmbiguous,
      startDate: state.startDate,
      completionDate: state.completionDate,
      lastActivityDate: state.latestActivityDate,
      startEventCount: state.startEventCount,
      campaignRequiresReview: state.startEventCount > 1,
      activityCount: accepted.filter(({ record }) => validDate(record.date)).length,
      undatedCount: accepted.filter(({ record }) => !validDate(record.date)).length,
      hours: plot.hours,
      fuel: plot.fuel,
      refill: calculateKpis(view.filteredValidatedRecords.filter(({ record }) => record.plotCode === plot.code)).refill,
      efficiency: plot.efficiency,
      sourceRows: rows.map(({ record }) => record.source.row),
      areaSourceRows: plot.areaMetadata.sourceRows.map((source) => source.row),
      activities: rows.map(({ record, duplicateOf, invalidFields }) => ({
        sourceRow: record.source.row,
        date: validDate(record.date) ? record.date : null,
        hmStart: record.hmStart,
        hmEnd: record.hmEnd,
        workingHours: record.workingHours,
        estimatedWorkingHours: record.estimatedWorkingHours,
        actualFuelUsage: record.actualFuelUsage,
        fuelRefill: record.fuelRefill,
        workStatus: record.workStatus,
        notes: record.notes,
        duplicateOf,
        invalidFields,
        issues: (issuesByRow.get(record.source.row) ?? []).map(({ message }) => message),
      })).sort((a, b) => (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99") || a.sourceRow - b.sourceRow),
      fuelRefills: rows.filter(({ record }) => record.cellStates.fuelRefill !== "missing").map(({ record, duplicateOf, invalidFields }) => ({
        sourceRow: record.source.row,
        activityDate: validDate(record.date) ? record.date : null,
        liters: invalidFields.includes("fuelRefill") ? null : record.fuelRefill,
        rawValue: record.raw[10] == null ? "" : String(record.raw[10]),
        note: record.notes,
        duplicateOf,
        issues: (issuesByRow.get(record.source.row) ?? []).filter(({ field }) => field === "fuelRefill").map(({ message }) => message),
      })).sort((a, b) => (a.activityDate ?? "9999-99-99").localeCompare(b.activityDate ?? "9999-99-99") || a.sourceRow - b.sourceRow),
      issues: issues.map(({ severity, code, message, source }) => ({ severity, code, message, row: source.row })),
    };
  });

  const finance = buildFinanceView(financeRows, operationRows, allDates, {
    financeSpkMerges: options.financeSpkMerges,
    financePlotMerges: options.financePlotMerges,
    operationSpkMerges: options.operationSpkMerges,
    operationPlotMerges: options.operationPlotMerges,
    operationWorksheet: options.operationWorksheet,
  });
  const spkNumbers = new Set(view.records.map((row) => row.spkNumber).filter((value): value is string => value !== null));
  finance.rows.forEach((row) => { if (row.spk) spkNumbers.add(row.spk); });
  const spks = [...spkNumbers].sort().map((number) => {
    const allActivities = view.validatedRecords.filter(({ record, duplicateOf }) => record.spkNumber === number && duplicateOf === null);
    const activities = allActivities.filter(({ record }) => validDate(record.date));
    const plotCodes = [...new Set(allActivities.map(({ record }) => record.plotCode).filter(Boolean))].sort();
    const verifiedAreas = plotCodes.map((code) => view.inventory.find((plot) => plot.code === code)).filter((plot) => plot && !plot.areaRequiresReview && plot.area !== null && plot.area > 0);
    const financeRowsForSpk = finance.rows.filter((row) => row.spk === number && row.matched);
    const metric = (field: "gross" | "fuelCost" | "margin") => {
      const values = financeRowsForSpk.map((row) => row[field]);
      const verified = values.filter((value): value is number => value !== null && Number.isFinite(value));
      return {
        value: verified.length ? verified.reduce((total, value) => total + value, 0) : null,
        verifiedCount: verified.length,
        totalCount: financeRowsForSpk.length,
        complete: financeRowsForSpk.length > 0 && verified.length === financeRowsForSpk.length,
      };
    };
    const operationIssues = view.issues.filter((issue) => validatedByRow.get(issue.source.row)?.record.spkNumber === number);
    const financeSourceRows = finance.financeRecords.filter((record) => record.spk === number).map((record) => record.row);
    const financeIssues = options.financeAvailable === false ? [] : finance.issues.filter((issue) => issue.worksheet === "Overview Finance" && (financeSourceRows.includes(issue.row) || issue.relatedRows?.some((row) => financeSourceRows.includes(row))));
    const dates = activities.map(({ record }) => record.date).filter(validDate).sort();
    return {
      number,
      plotCodes,
      verifiedArea: verifiedAreas.length === plotCodes.length && plotCodes.length > 0 ? verifiedAreas.reduce((total, plot) => total + plot!.area!, 0) : null,
      areaCoverage: { verifiedCount: verifiedAreas.length, totalCount: plotCodes.length },
      activityCount: activities.length,
      undatedCount: allActivities.length - activities.length,
      hours: calculateKpis(activities).hours,
      fuel: calculateKpis(activities).fuel,
      startDate: dates[0] ?? null,
      lastActivityDate: dates.at(-1) ?? null,
      finance: { gross: metric("gross"), fuelCost: metric("fuelCost"), margin: metric("margin") },
      relationships: plotCodes.map((code) => {
        const relatedActivities = allActivities.filter(({ record }) => record.plotCode === code);
        return { plot: code, spkSourceRows: [...new Set(relatedActivities.map(({ record }) => record.spkSource?.row ?? record.source.row))], operationRows: relatedActivities.map(({ record }) => record.source.row), financeRows: financeRowsForSpk.filter((row) => row.plot === code).map((row) => row.financeRow) };
      }),
      issues: [...operationIssues.map(({ severity, code, message, source }) => ({ severity, code, message, worksheet: source.worksheet, row: source.row })), ...financeIssues.map(({ code, message, worksheet, row }) => ({ severity: "warning" as const, code, message, worksheet, row }))],
    };
  });

  return { plots, spks, qualityIssueCount: view.issues.length + (options.financeAvailable === false ? 0 : finance.issues.length), operationRecordCount: view.records.length, financeRecordCount: finance.financeRecords.length };
}
