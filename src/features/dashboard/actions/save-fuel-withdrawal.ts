"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAllowedGoogleAccount } from "@/features/auth/allowlist";
import { validateFuelWithdrawalInput } from "../lib/fuel-withdrawal-input";
import { writeFuelWithdrawal } from "../data/server/fuel-withdrawal-writer";

export async function saveFuelWithdrawal(input: unknown) {
  if (process.env.ENABLE_FUEL_WITHDRAWAL_WRITES !== "true") return { ok: false, message: "Penyimpanan belum diaktifkan." };
  const session = await auth();
  const email = session?.user?.email;
  if (!isAllowedGoogleAccount(email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS) || !email) return { ok: false, message: "Masuk dengan akun Google yang diizinkan." };
  if (!input || typeof input !== "object" || !("date" in input) || !("plotCode" in input) || !("liters" in input) || typeof input.date !== "string" || typeof input.plotCode !== "string" || typeof input.liters !== "string" || !("expectedPrice" in input) || typeof input.expectedPrice !== "number" || !Number.isFinite(input.expectedPrice) || input.expectedPrice <= 0) return { ok: false, message: "Data pengambilan tidak valid." };
  const result = validateFuelWithdrawalInput({ date: input.date, plotCode: input.plotCode, liters: input.liters });
  if (!result.ok) return { ok: false, message: result.errors.join(" ") };
  const saved = await writeFuelWithdrawal({ ...result.value, price: input.expectedPrice }, email);
  if (saved.ok || saved.uncertain) { revalidatePath("/dashboard/operasional"); revalidatePath("/solar"); }
  return saved;
}
