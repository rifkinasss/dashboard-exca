"use server";
import { auth } from "@/auth";
import { isAdministrator } from "@/features/auth/server/permissions";
import { canInputTransactions } from "@/features/auth/allowlist";
import { readAccessUsers } from "@/features/settings/data/viewer-access";
import { revalidatePath } from "next/cache";
import { parseOverviewNumber } from "@/features/dashboard/lib/normalize-overview";
import { invalidateFuelWithdrawals } from "@/features/dashboard/data/server/fuel-withdrawal-source";
import { legacyPlotRouteId } from "../lib/plot-state";
import { invalidateDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { invalidateFinanceData } from "@/features/finance/data/server/finance-source";
import { invalidatePlotPrices } from "../data/server/plot-price-source";
import { parsePlotMeasurement } from "../lib/plot-measurement";
import { activityEditColumns, type ActivityEditDraft } from "../lib/plot-activity-edit";
import { toPlotSheetStatus } from "../lib/plot-sheet";
import { addPlotSpk, changePlot, createPlotActivity, createPlotBlock, plotWriterReady } from "../data/server/plot-sheet-writer";

export async function savePlot(input: unknown) {
  if (process.env.ENABLE_PLOT_WRITES !== "true") return { ok: false, message: "Penyimpanan petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  if (!email || !await isAdministrator(email)) return { ok: false, message: "Masuk dengan akun administrator yang diizinkan." };
  if (!input || typeof input !== "object" || !("code" in input) || typeof input.code !== "string" || ("spk" in input && typeof input.spk !== "string") || !("pricePerHa" in input) || typeof input.pricePerHa !== "string" || !("area" in input) || typeof input.area !== "string") return { ok: false, message: "Kode, harga per hektar, dan luas petak wajib diisi." };
  const code = input.code.trim().replace(/\s+/g, " ");
  const spkInput = "spk" in input ? input.spk : undefined;
  const spk = typeof spkInput === "string" ? spkInput.trim() : "";
  const area = parseOverviewNumber(input.area, "id-ID");
  const pricePerHa = parseOverviewNumber(input.pricePerHa, "id-ID");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,49}$/u.test(code)) return { ok: false, message: "Kode petak tidak valid." };
  if (spk && !/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,79}$/u.test(spk)) return { ok: false, message: "Nomor SPK tidak valid." };
  if (area.state !== "valid" || area.value <= 0) return { ok: false, message: "Luas harus berupa angka lebih besar dari nol." };
  if (pricePerHa.state !== "valid" || !Number.isSafeInteger(pricePerHa.value) || pricePerHa.value <= 0) return { ok: false, message: "Harga per hektar harus berupa Rupiah bulat lebih besar dari nol." };
  if (!Number.isFinite(pricePerHa.value * area.value)) return { ok: false, message: "Total nilai petak di luar rentang angka yang dapat disimpan." };
  const result = await createPlotBlock({ code, spk, pricePerHa: pricePerHa.value, area: area.value }, email);
  if (result.ok || result.uncertain) refreshPlotPages();
  return result;
}

export async function savePlotSpk(input: unknown) {
  if (process.env.ENABLE_PLOT_WRITES !== "true") return { ok: false, message: "Penyimpanan petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  if (!email || !await isAdministrator(email)) return { ok: false, message: "Masuk dengan akun administrator yang diizinkan." };
  if (!input || typeof input !== "object" || !("code" in input) || typeof input.code !== "string" || !("spk" in input) || typeof input.spk !== "string") return { ok: false, message: "Kode petak dan nomor SPK wajib diisi." };
  const code = input.code.trim().replace(/\s+/g, " ");
  const spk = input.spk.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,49}$/u.test(code)) return { ok: false, message: "Kode petak tidak valid." };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,79}$/u.test(spk)) return { ok: false, message: "Nomor SPK wajib diisi dan tidak valid." };
  const result = await addPlotSpk({ code, spk }, email);
  if (result.ok || result.uncertain) refreshPlotPages();
  return result;
}

export async function savePlotActivity(input: unknown) {
  if (process.env.ENABLE_PLOT_WRITES !== "true") return { ok: false, message: "Penyimpanan aktivitas petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  const canWrite = Boolean(email && (await isAdministrator(email) || await readAccessUsers().then((users) => canInputTransactions(email, users)).catch(() => false)));
  if (!email || !canWrite) return { ok: false, message: "Masuk dengan akun yang memiliki izin mencatat transaksi." };
  if (!input || typeof input !== "object" || !("code" in input) || typeof input.code !== "string" || !("date" in input) || typeof input.date !== "string" || !("hasActivity" in input) || typeof input.hasActivity !== "boolean" || !("hasFuel" in input) || typeof input.hasFuel !== "boolean") return { ok: false, message: "Kode petak, tanggal, dan status catatan wajib tersedia." };
  const values = input as Record<string, unknown>;
  const text = (key: string) => typeof values[key] === "string" ? (values[key] as string).trim() : "";
  const code = input.code.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,49}$/u.test(code)) return { ok: false, message: "Kode petak tidak valid." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(`${input.date}T00:00:00Z`)) || new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !== input.date) return { ok: false, message: "Tanggal aktivitas tidak valid." };
  const numeric = (key: string) => {
    const raw = text(key);
    if (!raw) return { value: null as number | null, error: false };
    const parsed = parsePlotMeasurement(raw);
    return parsed.state === "valid" ? { value: parsed.value, error: false } : { value: null, error: true };
  };
  const hmStart = numeric("hmStart"), hmEnd = numeric("hmEnd"), fuelPerHour = numeric("fuelPerHour"), refill = numeric("refill");
  if ([hmStart, hmEnd, fuelPerHour, refill].some((item) => item.error)) return { ok: false, message: "Nilai HM, pemakaian solar per jam, atau jumlah solar harus berupa angka yang valid." };
  if (input.hasActivity && (hmStart.value === null || hmEnd.value === null || fuelPerHour.value === null || fuelPerHour.value <= 0)) return { ok: false, message: "HM awal, HM akhir, dan pemakaian solar per jam wajib diisi." };
  const liters = input.hasFuel ? refill.value : 0;
  if (input.hasFuel && (liters === null || liters <= 0) || !input.hasFuel && liters !== null && liters !== 0) return { ok: false, message: "Isi jumlah solar lebih dari nol, atau pilih tidak mengisi." };
  if (hmStart.value !== null && hmEnd.value !== null && hmEnd.value < hmStart.value) return { ok: false, message: "HM akhir tidak boleh lebih kecil dari HM awal." };
  const statusInput = text("status");
  const status = statusInput ? toPlotSheetStatus(statusInput) : "";
  if (statusInput && !status) return { ok: false, message: "Status pekerjaan tidak valid." };
  const result = await createPlotActivity({ code, date: input.date, hmStart: hmStart.value, hmEnd: hmEnd.value, fuelPerHour: input.hasActivity ? fuelPerHour.value : null, refill: liters ?? 0, status: status ?? "", notes: text("notes").slice(0, 1000) }, email);
  if (result.ok || result.uncertain) refreshPlotPages();
  return result;
}


function refreshPlotPages() {
  invalidateDashboardData();
  invalidateFinanceData();
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/petak");
  revalidatePath("/petak/[plotId]", "page");
  revalidatePath("/aktivitas");
  revalidatePath("/spk");
  revalidatePath("/keuangan");
}

function validTarget(input: unknown): input is Record<string, unknown> & { code: string; sourceRow: number } {
  if (!input || typeof input !== "object") return false;
  const { code, sourceRow } = input as Record<string, unknown>;
  return typeof code === "string" && code.length <= 100 && code.trim().length > 0
    && typeof sourceRow === "number" && Number.isSafeInteger(sourceRow) && sourceRow >= 1;
}

export async function updatePlotActivity(input: unknown) {
  if (!plotWriterReady()) return { ok: false, message: "Penyimpanan aktivitas petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  const allowed = email && (await isAdministrator(email) || await readAccessUsers().then((users) => canInputTransactions(email, users)).catch(() => false));
  if (!email || !allowed) return { ok: false, message: "Masuk dengan akun yang memiliki izin mencatat transaksi." };
  if (!validTarget(input) || typeof input.snapshot !== "string" || input.snapshot.length > 65000 || !input.draft || typeof input.draft !== "object") {
    return { ok: false, message: "Identitas aktivitas tidak valid." };
  }
  const draft = input.draft as Record<string, unknown>;
  if (Object.keys(activityEditColumns).some((key) => typeof draft[key] !== "string" || draft[key].length > 50000)) {
    return { ok: false, message: "Isian aktivitas tidak valid." };
  }
  const result = await changePlot({ kind: "edit", code: input.code, sourceRow: input.sourceRow, snapshot: input.snapshot, draft: draft as ActivityEditDraft, close: input.close === true }, email);
  if (result.ok || result.uncertain) refreshPlotPages();
  return result;
}

export async function deletePlot(input: unknown) {
  if (!plotWriterReady()) return { ok: false, message: "Penyimpanan petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  if (!email || !await isAdministrator(email)) return { ok: false, message: "Masuk dengan akun administrator yang diizinkan." };
  if (!validTarget(input)) return { ok: false, message: "Identitas petak tidak valid." };
  const result = await changePlot({ kind: "delete", code: input.code, sourceRow: input.sourceRow }, email);
  if (result.ok || result.uncertain) refreshPlotPages();
  return result;
}

export async function deletePlotActivity(input: unknown) {
  if (!plotWriterReady()) return { ok: false, message: "Penyimpanan aktivitas petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  if (!email || !await isAdministrator(email)) return { ok: false, message: "Masuk dengan akun administrator yang diizinkan." };
  if (!validTarget(input) || typeof input.snapshot !== "string" || input.snapshot.length > 65000) {
    return { ok: false, message: "Identitas aktivitas tidak valid." };
  }
  const result = await changePlot({ kind: "delete-activity", code: input.code, sourceRow: input.sourceRow, snapshot: input.snapshot }, email);
  if (result.ok || result.uncertain) refreshPlotPages();
  return result;
}

export async function updatePlotMetadata(input: unknown) {
  if (!plotWriterReady()) return { ok: false, message: "Penyimpanan petak belum diaktifkan." };
  const email = (await auth())?.user?.email;
  if (!email || !await isAdministrator(email)) return { ok: false, message: "Masuk dengan akun administrator yang diizinkan." };
  if (!validTarget(input) || typeof input.nextCode !== "string" || typeof input.spk !== "string"
      || typeof input.pricePerHa !== "string" || typeof input.area !== "string" || !input.previous || typeof input.previous !== "object") {
    return { ok: false, message: "Data petak tidak valid." };
  }
  const previous = input.previous as Record<string, unknown>;
  if ((previous.spk !== null && typeof previous.spk !== "string")
      || (previous.pricePerHa !== null && (typeof previous.pricePerHa !== "number" || !Number.isFinite(previous.pricePerHa)))
      || (previous.area !== null && (typeof previous.area !== "number" || !Number.isFinite(previous.area)))) {
    return { ok: false, message: "Data awal petak tidak valid. Muat ulang halaman." };
  }
  const code = input.nextCode.trim().replace(/\s+/g, " ");
  const spk = input.spk.trim();
  const price = parseOverviewNumber(input.pricePerHa, "id-ID");
  const area = parseOverviewNumber(input.area, "id-ID");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,49}$/u.test(code)) return { ok: false, message: "Kode petak tidak valid." };
  if (spk && !/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,79}$/u.test(spk)) return { ok: false, message: "Nomor SPK tidak valid." };
  if (price.state !== "valid" || !Number.isSafeInteger(price.value) || price.value <= 0) return { ok: false, message: "Harga per hektar harus berupa Rupiah bulat lebih besar dari nol." };
  if (area.state !== "valid" || area.value <= 0) return { ok: false, message: "Luas petak harus berupa angka lebih besar dari nol." };
  const result = await changePlot({
    kind: "metadata", code: input.code, sourceRow: input.sourceRow, nextCode: code, spk, pricePerHa: price.value, area: area.value,
    previous: { spk: previous.spk, pricePerHa: previous.pricePerHa, area: previous.area },
  }, email);
  if (result.ok || result.uncertain) {
    invalidatePlotPrices();
    invalidateFuelWithdrawals();
    refreshPlotPages();
    revalidatePath("/solar");
    revalidatePath("/pengaturan");
  }
  return { ...result, plotId: result.ok ? legacyPlotRouteId(code) : undefined };
}
