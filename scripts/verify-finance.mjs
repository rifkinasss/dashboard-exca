import nextEnv from "@next/env";
import configModule from "../.test-build/dashboard/data/server/config.js";
import operationSource from "../.test-build/dashboard/data/server/dashboard-source.js";
import financeReader from "../.test-build/finance/data/server/google-finance.js";
import engine from "../.test-build/finance/lib/build-finance-view.js";
import overview from "../.test-build/dashboard/lib/overview.js";

nextEnv.loadEnvConfig(process.cwd());
try {
  const config = configModule.readSourceConfig(process.env);
  if (config.source !== "google-sheets") throw new Error("live source not configured");
  const [finance, operation] = await Promise.all([financeReader.createFinanceReader(config)(), operationSource.getDashboardData()]);
  if (operation.kind !== "ready" || operation.status.source !== "google-sheets") throw new Error("operational source unavailable");
  const options = { financeSpkMerges: finance.spkMerges, financePlotMerges: finance.plotCodeMerges, operationSpkMerges: operation.spkMerges, operationPlotMerges: operation.plotCodeMerges, operationWorksheet: operation.status.worksheet ?? "Overview Operasional" };
  const all = engine.buildFinanceView(finance.rows, operation.rows, { ...overview.defaultFilters, startDate: "", endDate: "" }, options);
  const periods = Object.fromEntries(all.operational.periods.map((period) => { const view = engine.buildFinanceView(finance.rows, operation.rows, overview.filtersForPeriod(period), options); return [period, { operationalPlots: view.operational.summary.totals.plotCount, operationalFuelRefill: view.operational.summary.totals.refill, financialGross: view.gross, financialCost: view.fuelCost }]; }));
  console.log(JSON.stringify({ verification: "READ_AND_PIPELINE_VERIFIED", financeRows: finance.rows.length, financeRecords: all.financeRecords.length, financeTotalRowsExcluded: all.summaryRows, operationalPairs: all.operationPairCount, matchedPairs: all.matchedCount, pairs: all.rows.map((row) => ({ spk: row.spk, plot: row.plot, sourceRow: row.financeRow, operationalRows: row.operationRows.length, gross: row.gross, fuelCost: row.fuelCost, margin: row.margin })), missingCostInputs: all.financeRecords.filter((record) => record.fuelCost === null).map((record) => ({ row: record.row, missing: [record.fuelPrice === null && "harga solar", record.fuelRefill === null && "pengisian solar", record.raw[8] == null || record.raw[8] === "" ? "pengeluaran solar" : false].filter(Boolean) })), estimate: { dates: all.dailyEstimate.rows.length, grossPairs: all.dailyEstimate.grossPairs, costPairs: all.dailyEstimate.costPairs, totalPairs: all.dailyEstimate.totalPairs, gross: all.dailyEstimate.rows.reduce((sum, row) => sum + (row.gross ?? 0), 0), cost: all.dailyEstimate.rows.reduce((sum, row) => sum + (row.cost ?? 0), 0), excluded: all.dailyEstimate.issues.map((issue) => ({ row: issue.row, code: issue.code })) }, coverage: { gross: all.grossCoverage, cost: all.costCoverage, margin: all.marginCoverage, pairedRevenue: all.pairedRevenue, pairedCost: all.pairedCost }, issues: Object.fromEntries([...Map.groupBy(all.issues, (issue) => issue.code)].map(([code, issues]) => [code, issues.length])), sourceGrossSnapshot: all.gross, verifiedFuelCostSnapshot: all.fuelCost, verifiedMarginSnapshot: all.margin, periods }, null, 2));
} catch {
  console.log(JSON.stringify({ verification: "FAILED", message: "Pembacaan atau pipeline belum dapat diverifikasi." }));
  process.exitCode = 1;
}
