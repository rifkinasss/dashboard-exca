import { resolveWithdrawalPricing, type FuelPriceCatalog } from "../../dashboard/lib/fuel-price";
import { selectPlotPurchases, type FuelWithdrawalData } from "../../dashboard/lib/fuel-withdrawals";
import { calculatePlotPrice, type PlotPrice } from "../../management/lib/plot-price";

export type FinanceDraftPlot = { code: string; spks: string[]; area: number | null; areaRequiresReview: boolean; campaignRequiresReview: boolean };

export function calculateFinanceDraft(plot: FinanceDraftPlot, prices: PlotPrice[] | null, purchases: FuelWithdrawalData | null, priceCatalog: FuelPriceCatalog | null) {
  const plotPrice = plot.campaignRequiresReview ? null : calculatePlotPrice(prices, plot);
  const rows = selectPlotPurchases(purchases, plot.code);
  const pricing = rows.map((row) => resolveWithdrawalPricing(row, priceCatalog));
  const priced = pricing.flatMap((item) => item.cost === null ? [] : [item.cost]);
  const total = priced.reduce((sum, cost) => sum + cost, 0);
  return {
    plotPrice,
    purchaseCost: purchases && priced.length && Number.isFinite(total) ? total : null,
    purchaseCount: rows.length,
    pricedCount: priced.length,
    estimatedCount: pricing.filter((item) => item.kind === "estimated").length,
    incompletePurchases: Boolean(purchases && (purchases.invalidRows.length || priced.length !== rows.length)),
  };
}
