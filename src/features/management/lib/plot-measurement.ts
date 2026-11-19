import { parseOverviewNumber } from "../../dashboard/lib/normalize-overview";

export function parsePlotMeasurement(value: string) {
  const trimmed = value.trim();
  const decimalDot = /^-?\d+\.\d{1,2}$/.test(trimmed);
  return parseOverviewNumber(decimalDot ? trimmed.replace(".", ",") : trimmed, "id-ID");
}
