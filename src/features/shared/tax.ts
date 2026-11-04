export function calculateTwoPercentTax(amount: number | null) {
  if (amount === null || !Number.isFinite(amount)) return null;
  const tax = amount * 0.02;
  return { tax, afterTax: amount - tax };
}
