import type { DashboardFilters, PlotCodeMerge, RawOverviewRow } from "../../dashboard/types";
import { buildDashboardViewModel } from "../../dashboard/lib/build-dashboard-view-model";
import { normalizeFinance } from "./normalize-finance";
import { relateFinance } from "./relationships";
import { buildDailyEstimate } from "./daily-estimate";

export function buildFinanceView(financeRows: readonly RawOverviewRow[], operationRows: readonly RawOverviewRow[], filters: DashboardFilters, options: { financeSpkMerges?: readonly PlotCodeMerge[]; financePlotMerges?: readonly PlotCodeMerge[]; operationSpkMerges?: readonly PlotCodeMerge[]; operationPlotMerges?: readonly PlotCodeMerge[]; operationWorksheet?: string } = {}) {
  const financial = normalizeFinance(financeRows, { spkMerges: options.financeSpkMerges, plotCodeMerges: options.financePlotMerges });
  const operational = buildDashboardViewModel(operationRows, { ...filters, statuses: [] }, { worksheetName: options.operationWorksheet, spkMerges: options.operationSpkMerges, plotCodeMerges: options.operationPlotMerges });
  const relationships = relateFinance(financial.records, operational.validatedRecords);
  const matched = relationships.matched.filter(({ pair }) => (!filters.selectedSpkNumbers.length || filters.selectedSpkNumbers.includes(pair.spk)) && (!filters.plotCodes.length || filters.plotCodes.includes(pair.plot)));
  const scopedRecords = financial.records.filter((record) => (!filters.selectedSpkNumbers.length || (record.spk !== null && filters.selectedSpkNumbers.includes(record.spk)) || matched.some((entry) => entry.record === record)) && (!filters.plotCodes.length || (record.plot !== null && filters.plotCodes.includes(record.plot))));
  const hasPeriod = Boolean(filters.startDate || filters.endDate);
  const completeLinks = matched.length > 0 && matched.length === scopedRecords.length;
  const sumComplete = (values: (number | null)[]) => {
    if (!values.length || values.some((value) => value === null || !Number.isFinite(value))) return null;
    const sum = values.reduce<number>((total, value) => total + value!, 0);
    return Number.isFinite(sum) ? sum : null;
  };
  const gross = completeLinks && !hasPeriod ? sumComplete(matched.map(({ record }) => record.grossValue)) : null;
  const fuelCost = completeLinks && !hasPeriod ? sumComplete(matched.map(({ record }) => record.fuelCost)) : null;
  const difference = gross !== null && fuelCost !== null ? gross - fuelCost : null;
  const margin = difference !== null && Number.isFinite(difference) ? difference : null;
  const rows = scopedRecords.map((record) => {
    const pair = matched.find((entry) => entry.record === record)?.pair;
    return { spk: pair?.spk ?? record.spk, plot: pair?.plot ?? record.plot, sourceSpk: record.spk, financeRow: record.row, operationRows: pair?.rows.map((row) => row.record.source.row) ?? [], matched: Boolean(pair), area: record.area, fuelRefill: record.fuelRefill, fuelCost: record.fuelCost, gross: record.grossValue, margin: pair && record.grossValue !== null && record.fuelCost !== null ? record.grossValue - record.fuelCost : null };
  });
  const coverage = (values: (number | null)[]) => {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
    const sum = valid.reduce((total, value) => total + value, 0);
    return { value: valid.length && Number.isFinite(sum) && !hasPeriod ? sum : null, eligibleCount: valid.length, totalCount: scopedRecords.length, missingCount: scopedRecords.length - valid.length, complete: valid.length > 0 && valid.length === scopedRecords.length };
  };
  const grossCoverage = coverage(rows.map((row) => row.matched ? row.gross : null));
  const costCoverage = coverage(rows.map((row) => row.matched ? row.fuelCost : null));
  const marginCoverage = coverage(rows.map((row) => row.margin));
  const pairedRevenue = coverage(rows.map((row) => row.margin !== null ? row.gross : null));
  const pairedCost = coverage(rows.map((row) => row.margin !== null ? row.fuelCost : null));
  const dailyEstimate = buildDailyEstimate(matched, filters);
  return { operational, rows, gross, fuelCost, margin, grossCoverage, costCoverage, marginCoverage, pairedRevenue, pairedCost, dailyEstimate, hasPeriod, completeLinks, financeRecords: financial.records, summaryRows: financial.summaries, issues: [...financial.issues, ...relationships.issues, ...dailyEstimate.issues], matchedCount: relationships.matched.length, operationPairCount: relationships.pairs.length };
}
