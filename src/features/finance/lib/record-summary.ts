import { resolveWithdrawalPricing, type FuelPriceCatalog } from "../../dashboard/lib/fuel-price";
import type { FuelWithdrawalData } from "../../dashboard/lib/fuel-withdrawals";
import { calculateTwoPercentTax } from "../../shared/tax";
import type { FinanceRecord } from "../types";

export function summarizeFinanceRecords(records: readonly FinanceRecord[], visible: readonly FinanceRecord[], eligibleRows: readonly number[] | null, purchases: FuelWithdrawalData | null, priceCatalog: FuelPriceCatalog | null, spkFiltered: boolean) {
  const eligible = new Set(eligibleRows ?? []);
  const amounts = eligibleRows ? visible.flatMap((row) => {
    const value = eligible.has(row.row) ? calculateTwoPercentTax(row.grossValue)?.afterTax : undefined;
    return value === undefined ? [] : [value];
  }) : [];
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  const afterTax = amounts.length && Number.isFinite(sum) ? sum : null;

  const visibleRows = new Set(visible.map((row) => row.row));
  const plots = new Set(visible.flatMap((row) => row.plot ? [row.plot] : []));
  const partialPlot = records.some((row) => row.plot && plots.has(row.plot) && !visibleRows.has(row.row));
  if (!purchases || spkFiltered || partialPlot || !visible.length || !plots.size) return { afterTax, afterTaxCount: amounts.length, cost: null, costCount: 0, purchaseCount: 0, estimatedCount: 0, incomplete: true, spkUnavailable: spkFiltered || partialPlot };
  const rows = purchases.records.filter((row) => plots.has(row.plotCode));
  const priced = rows.map((row) => resolveWithdrawalPricing(row, priceCatalog));
  const costs = priced.flatMap((price) => price.cost === null ? [] : [price.cost]);
  const costSum = costs.reduce((total, cost) => total + cost, 0);
  const incomplete = costs.length !== rows.length || purchases.invalidRows.length > 0 || visible.some((row) => !row.plot);
  return { afterTax, afterTaxCount: amounts.length, cost: (costs.length || (!rows.length && !incomplete)) && Number.isFinite(costSum) ? costSum : null, costCount: costs.length, purchaseCount: rows.length, estimatedCount: priced.filter((price) => price.kind === "estimated").length, incomplete, spkUnavailable: false };
}
