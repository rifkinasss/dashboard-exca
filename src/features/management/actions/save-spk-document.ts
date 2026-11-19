"use server";
import { auth } from "@/auth";
import { isAdministrator } from "@/features/auth/server/permissions";
import { revalidatePath } from "next/cache";
import { saveSpkDocument } from "../data/server/spk-document-writer";

export async function saveSpkDocumentAction(input: unknown) {
  const email = (await auth())?.user?.email;
  if (!email || !await isAdministrator(email)) return { ok: false, message: "Masuk dengan akun administrator yang diizinkan." };
  if (!input || typeof input !== "object") return { ok: false, message: "Data administrasi SPK tidak valid." };
  const data = input as Record<string, unknown>;
  const number = typeof data.number === "string" ? data.number.trim() : "";
  const beritaAcaraNumber = typeof data.beritaAcaraNumber === "string" ? data.beritaAcaraNumber.trim() : "";
  const payoutNumber = typeof data.payoutNumber === "string" ? data.payoutNumber.trim() : "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,79}$/u.test(number)) return { ok: false, message: "Nomor SPK wajib diisi dan tidak valid." };
  if (beritaAcaraNumber.length > 100 || payoutNumber.length > 100) return { ok: false, message: "Nomor berita acara atau pencairan terlalu panjang." };
  const field = data.field;
  if (field !== undefined && field !== "spk" && field !== "beritaAcara" && field !== "payout") return { ok: false, message: "Jenis dokumen tidak valid." };
  if (field && (typeof data.fileId !== "string" || !/^[\w-]{10,200}$/.test(data.fileId) || typeof data.accessToken !== "string" || data.accessToken.length < 20 || data.accessToken.length > 5000)) return { ok: false, message: "File atau akses Google Drive tidak valid." };
  const result = await saveSpkDocument({ number, beritaAcaraNumber, payoutNumber, ...(field ? { field, fileId: data.fileId as string, accessToken: data.accessToken as string } : {}) }, email);
  if (result.ok || result.uncertain) revalidatePath("/spk");
  return result;
}
