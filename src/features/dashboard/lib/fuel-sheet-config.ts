const fuelWorksheet = "Pengambilan Solar";

export function fuelSheetConfig(env: Record<string, string | undefined>) {
  const withdrawal = env.FUEL_WITHDRAWAL_SHEET_NAME?.trim();
  const price = env.FUEL_PRICE_SHEET_NAME?.trim();
  if (Boolean(withdrawal) !== Boolean(price)) throw new Error("Kedua worksheet solar harus dikonfigurasi bersama.");
  return {
    withdrawal: withdrawal || fuelWorksheet,
    price: price || fuelWorksheet,
    testing: Boolean(withdrawal && (withdrawal !== fuelWorksheet || price !== fuelWorksheet)),
  };
}

export function sheetRange(sheet: string, range: string) {
  return `'${sheet.replace(/'/g, "''")}'!${range}`;
}

export function plotPriceSheet(env: Record<string, string | undefined>) {
  const name = env.PLOT_PRICE_SHEET_NAME?.trim();
  if (env.FUEL_TESTING_ONLY === "true" && (!name || !/(?:^|[\s_-])testing$/i.test(name))) {
    throw new Error("Worksheet harga petak testing belum dikonfigurasi.");
  }
  return name || "Master Harga Petak";
}

export function fuelWriteTargetsAllowed(env: Record<string, string | undefined>) {
  const withdrawal = env.FUEL_WITHDRAWAL_SHEET_NAME?.trim() ?? "";
  const price = env.FUEL_PRICE_SHEET_NAME?.trim() ?? "";
  if (env.FUEL_TESTING_ONLY === "true") {
    const testingWorksheet = `${fuelWorksheet} - testing`;
    return withdrawal === testingWorksheet && price === testingWorksheet;
  }
  return env.FUEL_TESTING_ONLY === "false" && withdrawal === fuelWorksheet && price === fuelWorksheet;
}
