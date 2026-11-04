import { calculateTwoPercentTax } from "../../shared/tax";

export interface PlotPrice { spk: string; plot: string; pricePerHa: number | null }

export function parsePlotPrices(values: unknown): PlotPrice[] {
  const headers = ["No", "No. SPK", "Kode Petak", "Harga Per Hektar", "Keterangan"];
  if (!Array.isArray(values) || !Array.isArray(values[0]) || headers.some((header, index) => values[0][index] !== header)) throw new Error("Header harga petak tidak sesuai");
  return values.slice(1).flatMap((row: unknown) => {
    if (!Array.isArray(row) || row.every((cell) => cell == null || cell === "")) return [];
    const spk = typeof row[1] === "string" ? row[1].trim() : "";
    const plot = typeof row[2] === "string" ? row[2].trim().toUpperCase() : "";
    if (!plot) return [];
    const pricePerHa = typeof row[3] === "number" && Number.isFinite(row[3]) && row[3] > 0 ? row[3] : null;
    return [{ spk, plot, pricePerHa }];
  });
}

export function calculatePlotPrice(prices: PlotPrice[] | null, plot: { code: string; spks: string[]; area: number | null; areaRequiresReview: boolean }) {
  if (!prices || plot.spks.length !== 1 || plot.area === null || !Number.isFinite(plot.area) || plot.area <= 0 || plot.areaRequiresReview) return null;
  const candidates = prices.filter((price) => price.plot === plot.code.trim().toUpperCase());
  if (candidates.some((price) => !price.spk)) return null;
  const matches = candidates.filter((price) => price.spk === plot.spks[0]);
  if (matches.length !== 1 || matches[0].pricePerHa === null) return null;
  const amount = matches[0].pricePerHa * plot.area;
  if (!Number.isFinite(amount)) return null;
  const taxResult = calculateTwoPercentTax(amount);
  if (!taxResult) return null;
  return { amount, ...taxResult, pricePerHa: matches[0].pricePerHa, area: plot.area };
}

