import { normalizePlotCode, parseOverviewNumber, validDate } from "./normalize-overview";

export type FuelWithdrawalInput = { date: string; plotCode: string; liters: string };

export function validateFuelWithdrawalInput(input: FuelWithdrawalInput) {
  const date = input.date.trim();
  const plot = normalizePlotCode(input.plotCode);
  const liters = parseOverviewNumber(input.liters, "id-ID");
  const errors: string[] = [];
  const serial = Date.parse(`${date}T00:00:00Z`) / 86400000 + 25569;
  if (!validDate(date) || !Number.isInteger(serial) || serial < 1 || serial > 2958465) errors.push("Tanggal pengambilan tidak valid.");
  if (plot.state !== "valid") errors.push("Kode petak wajib diisi.");
  if (liters.state !== "valid" || liters.value <= 0) errors.push("Jumlah solar harus lebih dari nol.");
  if (errors.length || plot.state !== "valid" || liters.state !== "valid") return { ok: false as const, errors };
  return { ok: true as const, value: { date, plotCode: plot.value, liters: liters.value } };
}
