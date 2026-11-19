"use server";
import { isAdministrator } from "@/features/auth/server/permissions";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { writeFuelPrice } from "../data/server/fuel-price-writer";

export async function saveFuelPrice(input: unknown) {
  if (process.env.ENABLE_FUEL_PRICE_WRITES !== "true") return { ok: false, message: "Penyimpanan harga belum diaktifkan." };
  const session = await auth();
  const email = session?.user?.email;
  if (!await isAdministrator(email) || !email) return { ok: false, message: "Masuk dengan akun Google yang diizinkan." };
  if (!input || typeof input !== "object" || !("kind" in input)) return { ok: false, message: "Data harga tidak valid." };
  let result;
  if (input.kind === "insert" && "date" in input && "price" in input && "active" in input && "note" in input && typeof input.date === "string" && typeof input.price === "string" && typeof input.active === "boolean" && typeof input.note === "string") {
    result = await writeFuelPrice({ kind: "insert", input: { date: input.date, price: input.price, active: input.active, note: input.note } }, email);
  } else if (input.kind === "activate" && "row" in input && "date" in input && "expectedPrice" in input && typeof input.row === "number" && Number.isSafeInteger(input.row) && input.row >= 5 && typeof input.date === "string" && typeof input.expectedPrice === "number" && Number.isFinite(input.expectedPrice) && input.expectedPrice > 0) {
    result = await writeFuelPrice({ kind: "activate", row: input.row, date: input.date, expectedPrice: input.expectedPrice }, email);
  } else if ((input.kind === "edit" || input.kind === "delete") && "row" in input && "date" in input && "expectedPrice" in input && typeof input.row === "number" && Number.isSafeInteger(input.row) && input.row >= 5 && typeof input.date === "string" && typeof input.expectedPrice === "number" && Number.isFinite(input.expectedPrice) && input.expectedPrice > 0) {
    if (input.kind === "delete") result = await writeFuelPrice({ kind: "delete", row: input.row, date: input.date, expectedPrice: input.expectedPrice }, email);
    else if ("input" in input && input.input && typeof input.input === "object" && "date" in input.input && "price" in input.input && "active" in input.input && "note" in input.input && typeof input.input.date === "string" && typeof input.input.price === "string" && typeof input.input.active === "boolean" && typeof input.input.note === "string") result = await writeFuelPrice({ kind: "edit", row: input.row, date: input.date, expectedPrice: input.expectedPrice, input: { date: input.input.date, price: input.input.price, active: input.input.active, note: input.input.note } }, email);
    else return { ok: false, message: "Data harga tidak valid." };
  } else return { ok: false, message: "Data harga tidak valid." };
  if (result.ok || result.uncertain) revalidatePath("/solar");
  return result;
}
