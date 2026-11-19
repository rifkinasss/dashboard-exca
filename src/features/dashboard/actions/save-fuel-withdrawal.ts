"use server";
import { isAdministrator } from "@/features/auth/server/permissions";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canInputTransactions } from "@/features/auth/allowlist";
import { validateFuelWithdrawalInput } from "../lib/fuel-withdrawal-input";
import { editFuelWithdrawalRow, writeFuelWithdrawal } from "../data/server/fuel-withdrawal-writer";
import { readAccessUsers } from "@/features/settings/data/viewer-access";
import type { FuelWithdrawal } from "../lib/fuel-withdrawals";

async function permittedEmail() {
  const email = (await auth())?.user?.email;
  if (!email) return null;
  if (await isAdministrator(email)) return email;
  return await readAccessUsers().then((users) => canInputTransactions(email, users)).catch(() => false) ? email : null;
}

export async function saveFuelWithdrawal(input: unknown) {
  if (process.env.ENABLE_FUEL_WITHDRAWAL_WRITES !== "true") return { ok: false, message: "Penyimpanan belum diaktifkan." };
  const email = await permittedEmail();
  if (!email) return { ok: false, message: "Masuk dengan akun yang memiliki izin mencatat transaksi." };
  if (!input || typeof input !== "object" || !("date" in input) || !("plotCode" in input) || !("liters" in input) || typeof input.date !== "string" || typeof input.plotCode !== "string" || typeof input.liters !== "string" || !("expectedPrice" in input) || typeof input.expectedPrice !== "number" || !Number.isFinite(input.expectedPrice) || input.expectedPrice <= 0) return { ok: false, message: "Data pengambilan tidak valid." };
  const result = validateFuelWithdrawalInput({ date: input.date, plotCode: input.plotCode, liters: input.liters });
  if (!result.ok) return { ok: false, message: result.errors.join(" ") };
  const saved = await writeFuelWithdrawal({ ...result.value, price: input.expectedPrice }, email);
  if (saved.ok || saved.uncertain) { revalidatePath("/dashboard/operasional"); revalidatePath("/solar"); }
  return saved;
}

export async function editFuelWithdrawal(input: unknown, snapshot: unknown) {
  if (process.env.ENABLE_FUEL_WITHDRAWAL_WRITES !== "true") return { ok: false, message: "Penyimpanan belum diaktifkan." };
  const email = await permittedEmail();
  if (!email) return { ok: false, message: "Akun tidak memiliki izin mengubah transaksi." };
  if (!input || typeof input !== "object" || !("date" in input) || !("plotCode" in input) || !("liters" in input) || typeof input.date !== "string" || typeof input.plotCode !== "string" || typeof input.liters !== "string" || !("expectedPrice" in input) || !(input.expectedPrice === null || typeof input.expectedPrice === "number" && Number.isFinite(input.expectedPrice) && input.expectedPrice > 0)) return { ok: false, message: "Data transaksi tidak valid." };
  if (!snapshot || typeof snapshot !== "object" || !("sourceRow" in snapshot) || !Number.isSafeInteger(snapshot.sourceRow) || !("date" in snapshot) || typeof snapshot.date !== "string" || !("plotCode" in snapshot) || typeof snapshot.plotCode !== "string" || !("liters" in snapshot) || typeof snapshot.liters !== "number" || !Number.isFinite(snapshot.liters) || !("price" in snapshot) || !(snapshot.price === null || typeof snapshot.price === "number" && Number.isFinite(snapshot.price)) || !("cost" in snapshot) || !(snapshot.cost === null || typeof snapshot.cost === "number" && Number.isFinite(snapshot.cost)) || !("priceInvalid" in snapshot) || typeof snapshot.priceInvalid !== "boolean") return { ok: false, message: "Data awal transaksi tidak valid." };
  const validated = validateFuelWithdrawalInput({ date: input.date, plotCode: input.plotCode, liters: input.liters });
  if (!validated.ok) return { ok: false, message: validated.errors.join(" ") };
  const saved = await editFuelWithdrawalRow(validated.value, snapshot as FuelWithdrawal, input.expectedPrice, email);
  if (saved.ok || saved.uncertain) { revalidatePath("/dashboard/operasional"); revalidatePath("/solar"); }
  return saved;
}
