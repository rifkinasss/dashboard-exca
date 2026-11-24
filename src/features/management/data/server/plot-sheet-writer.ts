import "server-only";
import { JWT } from "google-auth-library";
import { readSourceConfig } from "../../../dashboard/data/server/config";
import {
  isPlot2026Date,
  parsePlotSheet,
  plotActivityAverageIndex,
  plotActivityHeaderIndex,
  plotActivityHeaders,
  plotActivityTotalIndex,
  plot2026Worksheet,
  plotSheetRange,
} from "../../lib/plot-sheet";
import { allOverviewWorksheet, financeWorksheetName } from "../../../finance/types";
import { fuelSheetConfig, plotPriceSheet } from "../../../dashboard/lib/fuel-sheet-config";
import { parsePlotPrices } from "../../lib/plot-price";
import { plotWorksheetName } from "./plot-sheet-source";
import { activityEditDraft, latestDatedPlotActivity, planActivityEdit, type ActivityEditDraft } from "../../lib/plot-activity-edit";

let saving = false;
export function plotWriterReady() {
  return (
    process.env.ENABLE_PLOT_WRITES === "true" &&
    plotWorksheetName(process.env) !== null &&
    Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
    )
  );
}

type PlotChange = { kind: "edit"; code: string; sourceRow: number; snapshot: string; draft: ActivityEditDraft; close: boolean }
  | { kind: "metadata"; code: string; sourceRow: number; nextCode: string; spk: string; pricePerHa: number; area: number; previous: { spk: string | null; pricePerHa: number | null; area: number | null } }
  | { kind: "delete"; code: string; sourceRow: number }
  | { kind: "delete-activity"; code: string; sourceRow: number; snapshot: string };

export async function changePlot(input: PlotChange, actor: string): Promise<{ ok: boolean; message: string; uncertain?: boolean }> {
  if (!plotWriterReady()) return { ok: false, message: "Penyimpanan petak belum diaktifkan." };
  if (saving) return { ok: false, message: "Penyimpanan petak sedang berlangsung. Coba lagi setelah selesai." };
  saving = true;
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return { ok: false, message: "Sumber data bukan Google Sheets." };
    const worksheet = plotWorksheetName(process.env)!;
    const auth = new JWT({
      email: config.email, key: config.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      transporterOptions: { timeout: 15000, retry: false },
    });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const get = async <T>(url: string, params: Record<string, string>) =>
      (await auth.request<T>({ url, params, method: "GET", timeout: 15000, retry: false })).data;
    const read = async (range: string, valueRenderOption = "UNFORMATTED_VALUE", title = worksheet) =>
      (await get<{ values?: unknown[][] }>(`${base}/values/${encodeURIComponent(plotSheetRange(title, range))}`, { valueRenderOption })).values ?? [];
    const [metadata, rows] = await Promise.all([
      get<{ properties?: { locale?: string }; sheets?: { properties?: { sheetId?: number; title?: string } }[] }>(base, { fields: "properties(locale),sheets(properties(sheetId,title))" }),
      read("A:L"),
    ]);
    const sheetId = metadata.sheets?.find(({ properties }) => properties?.title === worksheet)?.properties?.sheetId;
    if (typeof sheetId !== "number" || !["id_ID", "id-ID", "id"].includes(metadata.properties?.locale ?? "")) {
      return { ok: false, message: "Worksheet petak tidak dapat diverifikasi." };
    }
    const sheetPlots = parsePlotSheet(rows);
    const plots = sheetPlots.filter(({ code }) => code.toUpperCase() === input.code.toUpperCase());
    if (plots.length !== 1) return { ok: false, message: "Blok petak tidak ditemukan atau kodenya ganda. Muat ulang halaman." };
    const plot = plots[0];
    const header = plotActivityHeaderIndex(plot.sourceRow);
    const total = plotActivityTotalIndex(rows, header);
    const average = plotActivityAverageIndex(rows, total);
    if (input.kind !== "metadata" && (!plotActivityHeaders.every((label, column) => rows[header]?.[column] === label) || total <= header + 1 || average <= total)) {
      return { ok: false, message: "Struktur tabel aktivitas petak tidak dapat diverifikasi." };
    }

    const requests: Record<string, unknown>[] = [];
    const update = (rowIndex: number, columnIndex: number, userEnteredValue?: Record<string, string | number>, targetSheetId = sheetId) => {
      requests.push({ updateCells: { start: { sheetId: targetSheetId, rowIndex, columnIndex }, rows: [{ values: [userEnteredValue ? { userEnteredValue } : {}] }], fields: "userEnteredValue" } });
    };
    let verify: () => Promise<boolean>;
    const activity = input.kind === "delete" || input.kind === "metadata" ? undefined : plot.activities.find(({ sourceRow }) => sourceRow === input.sourceRow);
    if (input.kind === "metadata") {
      if (plot.sourceRow !== input.sourceRow || plot.pricePerHa !== input.previous.pricePerHa || plot.area !== input.previous.area || plot.spk !== input.previous.spk) {
        return { ok: false, message: "Data petak sudah berubah. Buka ulang form untuk memuat data terbaru." };
      }
      const codeKey = (value: unknown) => String(value ?? "").trim().toUpperCase();
      const oldCode = codeKey(plot.code);
      const nextCode = codeKey(input.nextCode);
      const codeChanged = plot.code !== input.nextCode;
      const spkChanged = (plot.spk ?? "") !== input.spk;
      const priceChanged = plot.pricePerHa !== input.pricePerHa;
      const areaChanged = plot.area !== input.area;
      if (!codeChanged && !spkChanged && !priceChanged && !areaChanged) return { ok: true, message: "Tidak ada perubahan data petak." };
      if (nextCode !== oldCode && sheetPlots.some(({ code }) => codeKey(code) === nextCode)) {
        return { ok: false, message: "Kode petak sudah terdaftar." };
      }
      if (spkChanged && (plot.spkSourceRow === plot.sourceRow || rows[plot.spkSourceRow - 1]?.[0] !== "No. SPK")) {
        return { ok: false, message: "Petak ini belum mempunyai baris No. SPK pada worksheet." };
      }
      const amount = input.pricePerHa * input.area;
      if (!Number.isSafeInteger(input.pricePerHa) || input.pricePerHa <= 0 || input.area <= 0 || !Number.isFinite(amount)) {
        return { ok: false, message: "Harga per hektar atau luas petak tidak valid." };
      }
      if (process.env.FUEL_TESTING_ONLY === "true" && worksheet === plot2026Worksheet) {
        return { ok: false, message: "Worksheet petak produksi tidak dapat diubah dari mode testing." };
      }
      const sheetIdFor = (title: string) => metadata.sheets?.find(({ properties }) => properties?.title === title)?.properties?.sheetId;
      const master = plotPriceSheet(process.env);
      if (master === worksheet) return { ok: false, message: "Konfigurasi Master Harga Petak tidak sesuai." };
      const masterId = sheetIdFor(master);
      const priceRow = plot.sourceRow + 1;
      const totalRow = priceRow + 1;
      const areaRow = totalRow + 1;
      const startRow = plot.spkSourceRow;
      const fuelSheet = codeChanged ? fuelSheetConfig(process.env).withdrawal : null;
      const fuelId = fuelSheet ? sheetIdFor(fuelSheet) : undefined;
      if (fuelSheet && (fuelSheet === worksheet || fuelSheet === master || typeof fuelId !== "number"
        || (process.env.FUEL_TESTING_ONLY === "true" && fuelSheet !== "Pengambilan Solar - testing"))) {
        return { ok: false, message: "Worksheet pembelian solar untuk perubahan kode belum dapat diverifikasi." };
      }
      const finance = financeWorksheetName(process.env.GOOGLE_FINANCE_SHEET_NAME);
      const rekap = new Set([config.worksheet, finance]);
      rekap.delete(worksheet);
      const overviewChecks = codeChanged || spkChanged ? [...rekap].filter((name) => typeof sheetIdFor(name) === "number") : [];
      const [block, masterRows, fuelRows, overviewData] = await Promise.all([
        read(`A${startRow}:C${areaRow}`, "FORMULA"),
        typeof masterId === "number" ? read("A5:E", "FORMULA", master) : [],
        fuelSheet ? read("A4:F", "UNFORMATTED_VALUE", fuelSheet) : [],
        Promise.all(overviewChecks.map(async (name) => {
          const column = name === allOverviewWorksheet ? "H" : "C";
          const [formulas, codes] = await Promise.all([
            read("A1:P5", "FORMULA", name), read(`${column}2:${column}`, "UNFORMATTED_VALUE", name),
          ]);
          return { name, codes, derived: formulas.flat().some((value) => typeof value === "string" && value.startsWith("=") && value.includes("_Petak Overview")) };
        })),
      ]);
      for (const { name, codes, derived } of overviewData) {
        if (!derived && codes.some(([value]) => codeKey(value) === oldCode)) {
          return { ok: false, message: `Petak masih tercatat di rekap ${name}. Periksa hubungan data sebelum mengubah kode atau SPK.` };
        }
        if (nextCode !== oldCode && codes.some(([value]) => codeKey(value) === nextCode)) {
          return { ok: false, message: `Kode tujuan sudah tercatat di rekap ${name}.` };
        }
      }
      const formulaAt = (row: number) => String(block[row - startRow]?.[2] ?? "").startsWith("=");
      if (block[priceRow - startRow]?.[0] !== "Harga Petak / Ha" || block[totalRow - startRow]?.[0] !== "Total Nilai Petak"
        || (codeChanged && formulaAt(plot.sourceRow)) || (spkChanged && formulaAt(plot.spkSourceRow))
        || (priceChanged && formulaAt(priceRow)) || (areaChanged && formulaAt(areaRow))) {
        return { ok: false, message: "Data petak memakai rumus atau struktur yang perlu diperiksa di worksheet." };
      }
      const fuelRowsToMove: number[] = [];
      if (fuelSheet && typeof fuelId === "number") {
        if (!["No", "Tanggal Ambil", "Solar", "No Petak"].every((label, column) => fuelRows[0]?.[column] === label)) {
          return { ok: false, message: "Struktur worksheet pembelian solar belum dapat diverifikasi." };
        }
        if (nextCode !== oldCode && fuelRows.slice(1).some((row) => codeKey(row[3]) === nextCode)) {
          return { ok: false, message: "Kode tujuan sudah dipakai pada transaksi pembelian solar." };
        }
        fuelRows.slice(1).forEach((row, index) => {
          if (codeKey(row[3]) === oldCode) fuelRowsToMove.push(index + 5);
        });
        if (fuelRowsToMove.length) {
          const formulas = await read("D4:D", "FORMULA", fuelSheet);
          if (fuelRowsToMove.some((row) => codeKey(formulas[row - 4]?.[0]) !== oldCode)) {
            return { ok: false, message: "Kode petak pada transaksi solar memakai rumus atau sudah berubah. Periksa worksheet sebelum menyimpan." };
          }
          for (const row of fuelRowsToMove) update(row - 1, 3, { stringValue: input.nextCode }, fuelId);
        }
      }
      let mirrorRow: number | undefined;
      if (typeof masterId === "number") {
        parsePlotPrices(masterRows);
        const matches = masterRows.slice(1).flatMap((row, index) =>
          codeKey(row[2]) === oldCode ? [{ row, number: index + 6 }] : [],
        );
        if (nextCode !== oldCode && masterRows.slice(1).some((row) => codeKey(row[2]) === nextCode)) {
          return { ok: false, message: "Kode tujuan sudah terdaftar di Master Harga Petak." };
        }
        const match = matches[0];
        if (matches.length > 1 || (match && String(match.row[1] ?? "").trim() !== (plot.spk ?? ""))) {
          return { ok: false, message: "Pasangan petak dan SPK di Master Harga Petak belum dapat dipastikan." };
        }
        if (match) {
          const previous = match.row[3];
          if (priceChanged && previous != null && previous !== "" && previous !== input.previous.pricePerHa && previous !== input.pricePerHa) {
            return { ok: false, message: "Tarif di Master Harga Petak berbeda dari tarif operasional atau memakai rumus. Periksa kedua tarif sebelum menyimpan." };
          }
          mirrorRow = match.number;
          if (codeChanged) update(mirrorRow - 1, 2, { stringValue: input.nextCode }, masterId);
          if (spkChanged) update(mirrorRow - 1, 1, input.spk ? { stringValue: input.spk } : undefined, masterId);
          if (priceChanged) update(mirrorRow - 1, 3, { numberValue: input.pricePerHa }, masterId);
        }
      } else if (process.env.PLOT_PRICE_SHEET_NAME?.trim()) {
        return { ok: false, message: "Worksheet Master Harga Petak yang dikonfigurasi tidak ditemukan." };
      }
      if (codeChanged) update(plot.sourceRow - 1, 2, { stringValue: input.nextCode });
      if (spkChanged) update(plot.spkSourceRow - 1, 2, input.spk ? { stringValue: input.spk } : undefined);
      if (priceChanged) update(priceRow - 1, 2, { numberValue: input.pricePerHa });
      if (areaChanged) update(areaRow - 1, 2, { numberValue: input.area });
      if ((priceChanged || areaChanged) && !formulaAt(totalRow)) {
        update(totalRow - 1, 2, { formulaValue: `=C${priceRow}*C${areaRow}` });
      }
      verify = async () => {
        const [saved, [savedMirror], savedFuel] = await Promise.all([
          read(`A${startRow}:C${areaRow}`),
          mirrorRow ? read(`B${mirrorRow}:D${mirrorRow}`, "UNFORMATTED_VALUE", master) : [],
          fuelSheet && fuelRowsToMove.length ? read("D4:D", "UNFORMATTED_VALUE", fuelSheet) : [],
        ]);
        const savedPlot = parsePlotSheet(saved)[0];
        if (!savedPlot) return false;
        const totalValue = savedPlot.totalValue;
        return savedPlot.code === input.nextCode && (savedPlot.spk ?? "") === input.spk
          && savedPlot.pricePerHa === input.pricePerHa && savedPlot.area === input.area
          && (!(priceChanged || areaChanged) || (typeof totalValue === "number" && Math.abs(totalValue - amount) <= Math.max(1e-7, amount * 1e-12)))
          && (!mirrorRow || ((!codeChanged || savedMirror?.[1] === input.nextCode)
            && (!spkChanged || String(savedMirror?.[0] ?? "") === input.spk)
            && (!priceChanged || savedMirror?.[2] === input.pricePerHa)))
          && fuelRowsToMove.every((row) => savedFuel[row - 4]?.[0] === input.nextCode);
      };
    } else if (input.kind === "delete-activity" && activity) {
      if (JSON.stringify(activity) !== input.snapshot) return { ok: false, message: "Aktivitas sudah berubah. Muat ulang halaman sebelum menghapus." };
      const row = activity.sourceRow;
      const next = plot.activities.find(({ sourceRow }) => sourceRow > row)?.sourceRow;
      let stockFormula: string | undefined;
      if (next) {
        const [formulaRow] = await read(`A${next}:L${next}`, "FORMULA");
        const stock = formulaRow?.[9];
        const legacy = `=IF(AND(G${next}="";I${next}="");"";J${next - 1}+G${next}-I${next})`;
        if (typeof stock === "string" && stock.replaceAll(",", ";").replace(/\s/g, "") === legacy) {
          const prior = `J${header + 2}:J${next - 1}`;
          stockFormula = `=IF(AND(G${next}="";I${next}="");"";XLOOKUP(TRUE;ARRAYFORMULA(ISNUMBER(${prior}));${prior};0;0;-1)+N(G${next})-N(I${next}))`;
          update(next - 1, 9, { formulaValue: stockFormula });
        }
      }
      for (let column = 1; column < 12; column++) update(row - 1, column);
      verify = async () => {
        const [saved] = await read(`A${row}:L${row}`, "FORMULA");
        if (!saved || saved.slice(1).some((value) => value != null && value !== "")) return false;
        if (!next || !stockFormula) return true;
        const [nextSaved] = await read(`A${next}:L${next}`, "FORMULA");
        return String(nextSaved?.[9]).replaceAll(",", ";") === stockFormula;
      };
    } else if (input.kind === "edit" && activity) {
      if (JSON.stringify(activity) !== input.snapshot) return { ok: false, message: "Aktivitas sudah berubah. Muat ulang halaman sebelum mengedit." };
      if (input.close && latestDatedPlotActivity(plot.activities.filter(({ date }) => worksheet !== plot2026Worksheet || (date !== null && isPlot2026Date(date)))) !== activity) {
        return { ok: false, message: "Ada aktivitas yang lebih baru. Muat ulang sebelum menutup petak." };
      }
      const draft = input.close ? { ...activityEditDraft(activity), workStatus: "Selesai" } : input.draft;
      const plan = planActivityEdit(activity, draft, worksheet);
      if (!plan.cells) return { ok: false, message: plan.error };
      const { cells } = plan;
      if (!cells.length) return { ok: true, message: "Tidak ada perubahan aktivitas." };
      for (const { column, value, formula } of cells) {
        update(activity.sourceRow - 1, column, formula ? { formulaValue: formula } : typeof value === "number" ? { numberValue: value } : value === null ? undefined : { stringValue: value });
      }
      if (cells.some(({ column }) => column === 1)) requests.push({ repeatCell: {
        range: { sheetId, startRowIndex: activity.sourceRow - 1, endRowIndex: activity.sourceRow, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } },
        fields: "userEnteredFormat.numberFormat",
      } });
      verify = async () => {
        const range = `A${activity.sourceRow}:L${activity.sourceRow}`;
        const [saved] = await read(range);
        const [formulas] = cells.some(({ formula }) => formula) ? await read(range, "FORMULA") : [];
        return Boolean(saved) && cells.every(({ column, value, formula }) => formula
          ? String(formulas?.[column]).replaceAll(",", ";") === formula
          : (saved?.[column] === "" ? null : saved?.[column] ?? null) === value);
      };
    } else if (input.kind === "delete") {
      if (plot.sourceRow !== input.sourceRow) return { ok: false, message: "Posisi petak sudah berubah. Muat ulang daftar sebelum menghapus." };
      const first = plot.spkSourceRow - 1;
      const metadataRows = [plot.sourceRow - 1, plot.sourceRow, plot.sourceRow + 1, plot.sourceRow + 2, plot.sourceRow + 3];
      if (first < plot.sourceRow - 1) metadataRows.push(first);
      for (const row of metadataRows) update(row, 2);
      // Leave the labels and row positions intact so the first block can still serve as the creation template.
      const clear = (startRowIndex: number, endRowIndex: number, startColumnIndex: number, endColumnIndex: number) => {
        requests.push({ updateCells: {
          range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
          rows: [], fields: "userEnteredValue",
        } });
      };
      clear(header + 1, total, 1, 12);
      clear(total, total + 1, 4, 10);
      clear(average, average + 1, 4, 10);
      verify = async () => {
        const saved = await read(`A${first + 1}:L${average + 1}`, "FORMULA");
        const blank = (value: unknown) => value == null || value === "";
        return saved[header - first]?.[0] === "No" && saved[total - first]?.[0] === "Total"
          && saved[average - first]?.[0] === "Rata-Rata"
          && metadataRows.every((row) => blank(saved[row - first]?.[2]))
          && saved.slice(header + 1 - first, total - first).every((row) => row.slice(1).every(blank))
          && [total, average].every((row) => (saved[row - first] ?? []).slice(4, 10).every(blank));
      };
    } else {
      return { ok: false, message: "Aktivitas sudah berubah. Muat ulang halaman." };
    }
    submitted = true;
    await auth.request({ url: `${base}:batchUpdate`, method: "POST", data: { requests }, timeout: 15000, retry: false });
    if (!await verify()) throw new Error("Readback mismatch");
    if (input.kind === "metadata") {
      console.info("plot_metadata_updated", { actor, worksheet, row: input.sourceRow, code: input.code });
      return { ok: true, message: "Data petak berhasil diperbarui." };
    }
    console.info(input.kind === "edit" ? "plot_activity_updated" : input.kind === "delete-activity" ? "plot_activity_deleted" : "plot_deleted", { actor, worksheet, row: input.sourceRow, code: input.code });
    return { ok: true, message: input.kind === "edit" ? (input.close ? "Petak berhasil ditutup." : "Aktivitas berhasil diperbarui.") : input.kind === "delete-activity" ? "Aktivitas berhasil dihapus." : `Petak ${plot.code} berhasil dihapus.` };
  } catch {
    return submitted
      ? { ok: false, uncertain: true, message: "Hasil penyimpanan belum dapat dipastikan. Periksa data sebelum mencoba lagi." }
      : { ok: false, message: "Perubahan belum disimpan. Periksa akses dan struktur worksheet petak." };
  } finally {
    saving = false;
  }
}

export async function createPlotActivity(
  input: {
    code: string;
    date: string;
    hmStart: number | null;
    hmEnd: number | null;
    fuelPerHour: number | null;
    refill: number;
    status: string;
    notes: string;
  },
  actor: string,
): Promise<{ ok: boolean; message: string; uncertain?: boolean }> {
  if (!plotWriterReady())
    return {
      ok: false,
      message: "Penyimpanan petak belum diaktifkan.",
    };
  if (saving)
    return {
      ok: false,
      message:
        "Penyimpanan petak sedang berlangsung. Coba lagi setelah selesai.",
    };
  saving = true;
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets")
      return { ok: false, message: "Sumber data bukan Google Sheets." };
    const worksheet = plotWorksheetName(process.env)!;
    if (worksheet === plot2026Worksheet && !isPlot2026Date(input.date))
      return { ok: false, message: "Tanggal aktivitas harus antara 1 Oktober dan 31 Desember 2026." };
    const auth = new JWT({
      email: config.email,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      transporterOptions: { timeout: 15000, retry: false },
    });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const get = async (url: string, params: Record<string, string>) =>
      (
        await auth.request<unknown>({
          url,
          params,
          method: "GET",
          timeout: 15000,
          retry: false,
        })
      ).data;
    const metadata = (await get(base, {
      fields:
        "properties(locale),sheets(properties(sheetId,title,gridProperties(rowCount)),merges)",
    })) as {
      properties?: { locale?: string };
      sheets?: {
        properties?: {
          sheetId?: number;
          title?: string;
          gridProperties?: { rowCount?: number };
        };
        merges?: {
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }[];
      }[];
    };
    const sheet = metadata.sheets?.find(
      (item) => item.properties?.title === worksheet,
    );
    const sheetId = sheet?.properties?.sheetId,
      rowCount = sheet?.properties?.gridProperties?.rowCount;
    if (
      !sheet ||
      !["id_ID", "id-ID", "id"].includes(metadata.properties?.locale ?? "") ||
      typeof sheetId !== "number" ||
      typeof rowCount !== "number"
    )
      return {
        ok: false,
        message: "Worksheet petak tidak dapat diverifikasi.",
      };
    const range = (value: string) =>
      `${base}/values/${encodeURIComponent(plotSheetRange(worksheet, value))}`;
    const response = (await get(range("A:L"), {
      majorDimension: "ROWS",
      valueRenderOption: "FORMULA",
    })) as { values?: unknown[][] };
    const rows = response.values ?? [];
    const plot = parsePlotSheet(rows).find(
      (item) =>
        item.code.toLocaleUpperCase("id-ID") ===
        input.code.toLocaleUpperCase("id-ID"),
    );
    if (!plot)
      return {
        ok: false,
        message: "Blok petak tidak ditemukan pada worksheet yang dikonfigurasi.",
      };
    const headerIndex = plotActivityHeaderIndex(plot.sourceRow);
    if (!plotActivityHeaders.every((header, col) => rows[headerIndex]?.[col] === header))
      return {
        ok: false,
        message: "Tabel aktivitas pada blok petak tidak sesuai format.",
      };
    const firstActivityIndex = headerIndex + 1;
    const totalIndex = plotActivityTotalIndex(rows, headerIndex);
    const averageIndex = plotActivityAverageIndex(rows, totalIndex);
    if (totalIndex <= firstActivityIndex)
      return {
        ok: false,
        message: "Baris Total tabel aktivitas tidak ditemukan setelah header.",
      };
    if (averageIndex < 0)
      return {
        ok: false,
        message: "Baris Rata-Rata tidak ditemukan setelah Total.",
      };
    const activityIndexes = Array.from(
      { length: totalIndex - firstActivityIndex },
      (_, offset) => firstActivityIndex + offset,
    );
    const isEmptyActivity = (index: number) =>
      [1, 2, 3, 6, 7, 10, 11].every(
        (column) =>
          rows[index]?.[column] === "" || rows[index]?.[column] == null,
      );
    const numberedIndexes = activityIndexes.filter(
      (index) =>
        typeof rows[index]?.[0] === "number" ||
        /^\d+$/.test(String(rows[index]?.[0] ?? "")),
    );
    const availableIndex = numberedIndexes.find(isEmptyActivity);
    const extendTable = availableIndex === undefined;
    const latestStatus = latestDatedPlotActivity(plot.activities.filter(({ date, workStatus }) =>
      workStatus && (worksheet !== plot2026Worksheet || (date !== null && isPlot2026Date(date))),
    ))?.workStatus;
    if ((extendTable || input.fuelPerHour !== null || input.status) && latestStatus === "Selesai")
      return {
        ok: false,
        message:
          "Petak sudah selesai digarap. Baris aktivitas tidak ditambahkan.",
      };
    if (extendTable && activityIndexes.length < 6)
      return {
        ok: false,
        message:
          "Tabel aktivitas tidak memiliki enam baris awal yang diharapkan.",
      };
    const lastActivityIndex =
      activityIndexes.filter((index) => !isEmptyActivity(index)).at(-1) ??
      firstActivityIndex - 1;
    const extensionIndex = extendTable
      ? activityIndexes.find(
          (index) => index > lastActivityIndex && isEmptyActivity(index),
        )
      : undefined;
    const insertRow = extendTable && extensionIndex === undefined;
    const writeIndex = availableIndex ?? extensionIndex ?? totalIndex;
    const sourceActivityIndex = numberedIndexes.at(-1) ?? lastActivityIndex;
    const totalSolarIndex = rows.findIndex(
      (row, index) =>
        index >= plot.sourceRow - 1 &&
        index < headerIndex &&
        row?.[0] === "Total Konsumsi Solar",
    );
    if (totalSolarIndex < 0)
      return {
        ok: false,
        message: "Baris total konsumsi solar tidak ditemukan.",
      };
    if (
      extendTable &&
      (sheet.merges ?? []).some(
        (merge) =>
          (merge.startRowIndex ?? 0) < totalIndex &&
          (merge.endRowIndex ?? 0) > totalIndex,
      )
    )
      return {
        ok: false,
        message:
          "Baris Total memiliki sel gabung vertikal dan tidak dapat diperpanjang dengan aman.",
      };
    if (
      !insertRow &&
      (writeIndex + 1 > rowCount ||
        (sheet.merges ?? []).some(
          (merge) =>
            (merge.startRowIndex ?? 0) <= writeIndex &&
            (merge.endRowIndex ?? 0) > writeIndex &&
            (merge.startColumnIndex ?? 0) < 12,
        ))
    )
      return {
        ok: false,
        message: "Baris aktivitas memiliki sel gabung atau di luar worksheet.",
      };
    const rowNumber = writeIndex + 1;
    const activityNumber =
      availableIndex === undefined
        ? writeIndex - firstActivityIndex + 1
        : Number(rows[availableIndex][0]);
    const serialDate =
      Math.round(Date.parse(`${input.date}T00:00:00Z`) / 86400000) + 25569;
    const value = (v: string | number) => ({
      userEnteredValue:
        typeof v === "number" ? { numberValue: v } : { stringValue: v },
    });
    const cells: Record<string, unknown>[] = [
      value(serialDate),
      ...(input.hmStart === null ? [{}] : [value(input.hmStart)]),
      ...(input.hmEnd === null ? [{}] : [value(input.hmEnd)]),
      {
        userEnteredValue: {
          formulaValue: `=IF(AND(C${rowNumber}="";D${rowNumber}="");"";D${rowNumber}-C${rowNumber})`,
        },
      },
      {
        userEnteredValue: {
          formulaValue: `=IF(E${rowNumber}="";"";ROUND(E${rowNumber}))`,
        },
      },
      value(input.refill),
      ...(input.fuelPerHour === null ? [{}] : [value(input.fuelPerHour)]),
      {
        userEnteredValue: {
          formulaValue: `=IF(OR(H${rowNumber}="";E${rowNumber}="");"";H${rowNumber}*E${rowNumber})`,
        },
      },
      {
        userEnteredValue: {
          formulaValue:
            writeIndex === firstActivityIndex
              ? `=IF(G${rowNumber}="";"";G${rowNumber}-N(I${rowNumber}))`
              : `=IF(AND(G${rowNumber}="";I${rowNumber}="");"";J${rowNumber - 1}+G${rowNumber}-I${rowNumber})`,
        },
      },
      ...(input.status ? [value(input.status)] : [{}]),
      ...(input.notes ? [value(input.notes)] : [{}]),
    ];
    submitted = true;
    const requests: Record<string, unknown>[] = [];
    if (insertRow) {
      requests.push({
        insertDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: totalIndex,
            endIndex: totalIndex + 1,
          },
          inheritFromBefore: true,
        },
      });
    }
    if (extendTable)
      requests.push({
        copyPaste: {
          source: {
            sheetId,
            startRowIndex: sourceActivityIndex,
            endRowIndex: sourceActivityIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          destination: {
            sheetId,
            startRowIndex: writeIndex,
            endRowIndex: writeIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          pasteType: "PASTE_NORMAL",
          pasteOrientation: "NORMAL",
        },
      });
    requests.push(
      {
        updateCells: {
          start: { sheetId, rowIndex: writeIndex, columnIndex: 0 },
          rows: [{ values: [value(activityNumber), ...cells] }],
          fields: "userEnteredValue",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: writeIndex,
            endRowIndex: writeIndex + 1,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      },
    );
    if (extendTable) {
      const newTotalIndex = totalIndex + Number(insertRow);
      const newAverageIndex = averageIndex + Number(insertRow);
      const firstRow = firstActivityIndex + 1;
      const lastRow = writeIndex + 1;
      const sumCells = Array.from({ length: 6 }, (_, offset) => ({
        userEnteredValue: {
          formulaValue: `=IF(COUNT(${String.fromCharCode(69 + offset)}${firstRow}:${String.fromCharCode(69 + offset)}${lastRow})=0;"";SUM(${String.fromCharCode(69 + offset)}${firstRow}:${String.fromCharCode(69 + offset)}${lastRow}))`,
        },
      }));
      const averageCells = Array.from({ length: 6 }, (_, offset) => ({
        userEnteredValue: {
          formulaValue: `=IF(COUNT(${String.fromCharCode(69 + offset)}${firstRow}:${String.fromCharCode(69 + offset)}${lastRow})=0;"";AVERAGE(${String.fromCharCode(69 + offset)}${firstRow}:${String.fromCharCode(69 + offset)}${lastRow}))`,
        },
      }));
      requests.push(
        {
          updateCells: {
            start: { sheetId, rowIndex: totalSolarIndex, columnIndex: 2 },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      formulaValue: `=IF(COUNT(I${firstRow}:I${lastRow})=0;"";SUM(I${firstRow}:I${lastRow}))`,
                    },
                  },
                ],
              },
            ],
            fields: "userEnteredValue",
          },
        },
        {
          updateCells: {
            start: { sheetId, rowIndex: newTotalIndex, columnIndex: 4 },
            rows: [{ values: sumCells }],
            fields: "userEnteredValue",
          },
        },
        {
          updateCells: {
            start: { sheetId, rowIndex: newAverageIndex, columnIndex: 4 },
            rows: [{ values: averageCells }],
            fields: "userEnteredValue",
          },
        },
      );
    }
    await auth.request({
      url: `${base}:batchUpdate`,
      method: "POST",
      data: { requests },
      timeout: 15000,
      retry: false,
    });
    const check = (await get(range(`A${rowNumber}:G${rowNumber}`), {
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
    })) as { values?: unknown[][] };
    const saved = check.values?.[0];
    if (
      saved?.[0] !== activityNumber ||
      saved?.[1] !== serialDate ||
      saved?.[6] !== input.refill
    )
      throw new Error("Readback mismatch");
    console.info("plot_activity_created", {
      actor,
      worksheet,
      row: rowNumber,
      code: input.code,
      at: new Date().toISOString(),
    });
    return {
      ok: true,
      message: `Catatan aktivitas berhasil disimpan ke worksheet ${worksheet}.`,
    };
  } catch {
    return submitted
      ? {
          ok: false,
          uncertain: true,
          message:
            "Hasil penyimpanan belum dapat dipastikan. Periksa worksheet sebelum mencoba lagi.",
        }
      : {
          ok: false,
          message:
            "Catatan belum disimpan. Periksa akses dan format worksheet petak.",
        };
  } finally {
    saving = false;
  }
}

export async function createPlotBlock(
  input: { code: string; spk: string; pricePerHa: number; area: number },
  actor: string,
): Promise<{ ok: boolean; message: string; uncertain?: boolean }> {
  if (!plotWriterReady())
    return {
      ok: false,
      message: "Penyimpanan petak belum diaktifkan.",
    };
  if (saving)
    return {
      ok: false,
      message:
        "Penyimpanan petak sedang berlangsung. Coba lagi setelah selesai.",
    };
  saving = true;
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets")
      return { ok: false, message: "Sumber data bukan Google Sheets." };
    const worksheet = plotWorksheetName(process.env)!;
    const auth = new JWT({
      email: config.email,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      transporterOptions: { timeout: 15000, retry: false },
    });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const get = async (url: string, params: Record<string, string>) =>
      (
        await auth.request<unknown>({
          url,
          params,
          method: "GET",
          timeout: 15000,
          retry: false,
        })
      ).data;
    const metadata = (await get(base, {
      fields:
        "properties(locale),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),merges)",
    })) as {
      properties?: { locale?: string };
      sheets?: {
        properties?: {
          sheetId?: number;
          title?: string;
          gridProperties?: { rowCount?: number; columnCount?: number };
        };
        merges?: {
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }[];
      }[];
    };
    const sheet = metadata.sheets?.find(
      (item) => item.properties?.title === worksheet,
    );
    const sheetId = sheet?.properties?.sheetId,
      rowCount = sheet?.properties?.gridProperties?.rowCount,
      columnCount = sheet?.properties?.gridProperties?.columnCount;
    if (
      !sheet ||
      !["id_ID", "id-ID", "id"].includes(metadata.properties?.locale ?? "") ||
      typeof sheetId !== "number" ||
      typeof rowCount !== "number" ||
      typeof columnCount !== "number" ||
      columnCount < 12 ||
      !Array.isArray(sheet.merges ?? [])
    )
      return {
        ok: false,
        message: "Struktur worksheet petak tidak dapat diverifikasi.",
      };
    const merges = sheet.merges ?? [];
    const rangeUrl = (range: string) =>
      `${base}/values/${encodeURIComponent(plotSheetRange(worksheet, range))}`;
    const all = (await get(rangeUrl("A:AB"), {
      majorDimension: "ROWS",
      valueRenderOption: "FORMULA",
    })) as { values?: unknown[][] };
    const template = (await get(rangeUrl("A7:L23"), {
      majorDimension: "ROWS",
      valueRenderOption: "FORMULA",
    })) as { values?: unknown[][] };
    const overview = config.worksheet === worksheet ? null : (await get(
      `${base}/values/${encodeURIComponent(plotSheetRange(config.worksheet, "C2:C"))}`,
      { majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" },
    )) as { values?: unknown[][] };
    const rows = all.values ?? [],
      templateRows = template.values ?? [];
    const plots = parsePlotSheet(rows.map((row) => row.slice(0, 12)));
    const normalizedCode = input.code.toLocaleUpperCase("id-ID");
    if (
      plots.some(
        (plot) => plot.code.toLocaleUpperCase("id-ID") === normalizedCode,
      ) ||
      overview?.values?.some(
        (row) =>
          typeof row[0] === "string" &&
          row[0].trim().toLocaleUpperCase("id-ID") === normalizedCode,
      )
    )
      return {
        ok: false,
        message: "Kode petak sudah terdaftar di sumber operasional.",
      };
    if (
      templateRows.length < 16 ||
      templateRows[0]?.[0] !== "No. SPK" ||
      templateRows[1]?.[0] !== "Kode Petak" ||
      templateRows[2]?.[0] !== "Harga Petak / Ha" ||
      templateRows[3]?.[0] !== "Total Nilai Petak" ||
      templateRows[4]?.[0] !== "Luas Petak" ||
      templateRows[5]?.[0] !== "Total Konsumsi Solar" ||
      !plotActivityHeaders.every(
        (header, column) => templateRows[7]?.[column] === header,
      ) ||
      templateRows[14]?.[0] !== "Total" ||
      templateRows[15]?.[0] !== "Rata-Rata"
    )
      return {
        ok: false,
        message: "Blok contoh petak tidak sesuai format yang diharapkan.",
      };
    const lastRow = rows.reduce(
      (last, row, index) =>
        row.some(
          (value) => value !== "" && value !== null && value !== undefined,
        )
          ? index + 1
          : last,
      0,
    );
    const startRow = lastRow + 4,
      endRow = startRow + 16;
    if (endRow > rowCount)
      return {
        ok: false,
        message:
          "Worksheet tidak memiliki cukup baris kosong untuk blok petak baru.",
      };
    const target = (await get(rangeUrl(`A${startRow}:AB${endRow}`), {
      majorDimension: "ROWS",
      valueRenderOption: "FORMULA",
    })) as { values?: unknown[][] };
    if (
      target.values?.some((row) =>
        row.some(
          (value) => value !== "" && value !== null && value !== undefined,
        ),
      ) ||
      merges.some(
        (merge) =>
          (merge.startRowIndex ?? 0) < endRow &&
          (merge.endRowIndex ?? 0) > startRow - 1,
      )
    )
      return {
        ok: false,
        message:
          "Area tujuan blok petak tidak kosong atau memiliki sel gabung.",
      };
    const data = Array.from({ length: 17 }, () =>
      Array.from({ length: 12 }, () => ({}) as Record<string, unknown>),
    );
    const put = (row: number, column: number, value: string | number) => {
      data[row][column] =
        typeof value === "number"
          ? { userEnteredValue: { numberValue: value } }
          : { userEnteredValue: { stringValue: value } };
    };
    const formula = (row: number, column: number, value: string) => {
      data[row][column] = { userEnteredValue: { formulaValue: value } };
    };
    put(0, 0, "No. SPK");
    if (input.spk) put(0, 2, input.spk);
    put(1, 0, "Kode Petak");
    put(1, 2, input.code);
    put(2, 0, "Harga Petak / Ha");
    put(2, 2, input.pricePerHa);
    put(3, 0, "Total Nilai Petak");
    formula(
      3,
      2,
      `=IF(OR(C${startRow + 2}="";C${startRow + 4}="");"";C${startRow + 2}*C${startRow + 4})`,
    );
    put(4, 0, "Luas Petak");
    put(4, 2, input.area);
    put(4, 3, "Hektar");
    put(5, 0, "Total Konsumsi Solar");
    put(7, 0, "No");
    for (let column = 1; column < 12; column++) {
      const value = templateRows[7]?.[column];
      if (typeof value === "string" && value) put(7, column, value);
    }
    const firstActivity = startRow + 8,
      lastActivity = startRow + 13;
    for (let index = 0; index < 6; index++) {
      const row = firstActivity + index;
      put(8 + index, 0, index + 1);
      formula(
        8 + index,
        4,
        `=IF(AND(C${row}="";D${row}="");"";D${row}-C${row})`,
      );
      formula(8 + index, 5, `=IF(E${row}="";"";ROUND(E${row}))`);
      formula(
        8 + index,
        8,
        `=IF(OR(H${row}="";E${row}="");"";H${row}*E${row})`,
      );
      formula(
        8 + index,
        9,
        index === 0
          ? `=IF(G${row}="";"";G${row}-N(I${row}))`
          : `=IF(AND(G${row}="";I${row}="");"";J${row - 1}+G${row}-I${row})`,
      );
    }
    formula(
      5,
      2,
      `=IF(COUNT(I${firstActivity}:I${lastActivity})=0;"";SUM(I${firstActivity}:I${lastActivity}))`,
    );
    put(14, 0, "Total");
    put(15, 0, "Rata-Rata");
    for (let column = 4; column <= 9; column++) {
      const letter = String.fromCharCode(65 + column);
      formula(
        14,
        column,
        `=IF(COUNT(${letter}${firstActivity}:${letter}${lastActivity})=0;"";SUM(${letter}${firstActivity}:${letter}${lastActivity}))`,
      );
      formula(
        15,
        column,
        `=IF(COUNT(${letter}${firstActivity}:${letter}${lastActivity})=0;"";AVERAGE(${letter}${firstActivity}:${letter}${lastActivity}))`,
      );
    }
    const requests: Record<string, unknown>[] = [
      {
        copyPaste: {
          source: {
            sheetId,
            startRowIndex: 6,
            endRowIndex: 23,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          destination: {
            sheetId,
            startRowIndex: startRow - 1,
            endRowIndex: startRow + 16,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          pasteType: "PASTE_FORMAT",
          pasteOrientation: "NORMAL",
        },
      },
      {
        updateCells: {
          start: { sheetId, rowIndex: startRow - 1, columnIndex: 0 },
          rows: data.map((values) => ({ values })),
          fields: "userEnteredValue",
        },
      },
    ];
    for (const merge of merges)
      if ((merge.startRowIndex ?? -1) >= 6 && (merge.endRowIndex ?? 0) <= 23) {
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: startRow - 1 + merge.startRowIndex! - 6,
              endRowIndex: startRow - 1 + merge.endRowIndex! - 6,
              startColumnIndex: merge.startColumnIndex,
              endColumnIndex: merge.endColumnIndex,
            },
            mergeType: "MERGE_ALL",
          },
        });
      }
    submitted = true;
    await auth.request({
      url: `${base}:batchUpdate`,
      method: "POST",
      data: { requests },
      timeout: 15000,
      retry: false,
    });
    const check = (await get(rangeUrl(`A${startRow}:D${startRow + 4}`), {
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
    })) as { values?: unknown[][] };
    const savedSpk = check.values?.[0]?.[2];
    if (
      (input.spk
        ? savedSpk !== input.spk
        : savedSpk != null && savedSpk !== "") ||
      check.values?.[1]?.[2] !== input.code ||
      check.values?.[2]?.[2] !== input.pricePerHa ||
      check.values?.[3]?.[2] !== input.pricePerHa * input.area ||
      check.values?.[4]?.[2] !== input.area
    )
      throw new Error("Readback mismatch");
    console.info("plot_block_created", {
      actor,
      worksheet,
      startRow,
      code: input.code,
      spk: input.spk,
      at: new Date().toISOString(),
    });
    return {
      ok: true,
      message: `Petak baru berhasil ditambahkan ke worksheet ${worksheet}.`,
    };
  } catch {
    return submitted
      ? {
          ok: false,
          uncertain: true,
          message:
            "Hasil penyimpanan belum dapat dipastikan. Periksa worksheet sebelum mencoba lagi.",
        }
      : {
          ok: false,
          message:
            "Petak belum disimpan. Periksa akses dan struktur worksheet petak.",
        };
  } finally {
    saving = false;
  }
}

export async function addPlotSpk(
  input: { code: string; spk: string },
  actor: string,
): Promise<{ ok: boolean; message: string; uncertain?: boolean }> {
  if (!plotWriterReady())
    return {
      ok: false,
      message: "Penyimpanan petak belum diaktifkan.",
    };
  if (saving)
    return {
      ok: false,
      message:
        "Penyimpanan petak sedang berlangsung. Coba lagi setelah selesai.",
    };
  saving = true;
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets")
      return { ok: false, message: "Sumber data bukan Google Sheets." };
    const worksheet = plotWorksheetName(process.env)!;
    const auth = new JWT({
      email: config.email,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      transporterOptions: { timeout: 15000, retry: false },
    });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const get = async (url: string, params: Record<string, string>) =>
      (
        await auth.request<unknown>({
          url,
          params,
          method: "GET",
          timeout: 15000,
          retry: false,
        })
      ).data;
    const metadata = (await get(base, {
      fields: "properties(locale),sheets(properties(sheetId,title))",
    })) as {
      properties?: { locale?: string };
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };
    const sheet = metadata.sheets?.find(
      (item) => item.properties?.title === worksheet,
    );
    const sheetId = sheet?.properties?.sheetId;
    if (
      !sheet ||
      !["id_ID", "id-ID", "id"].includes(metadata.properties?.locale ?? "") ||
      typeof sheetId !== "number"
    )
      return {
        ok: false,
        message: "Worksheet petak tidak dapat diverifikasi.",
      };
    const rangeUrl = (range: string) =>
      `${base}/values/${encodeURIComponent(plotSheetRange(worksheet, range))}`;
    const all = (await get(rangeUrl("A:L"), {
      majorDimension: "ROWS",
      valueRenderOption: "FORMULA",
    })) as { values?: unknown[][] };
    const rows = all.values ?? [];
    const plot = parsePlotSheet(rows).find(
      (item) =>
        item.code.toLocaleUpperCase("id-ID") ===
        input.code.toLocaleUpperCase("id-ID"),
    );
    if (!plot || rows[plot.spkSourceRow - 1]?.[0] !== "No. SPK")
      return {
        ok: false,
        message:
          "Blok petak tidak ditemukan atau belum memakai format SPK terbaru.",
      };
    const existingSpk = plot.spk ?? "";
    if (existingSpk === input.spk)
      return { ok: true, message: "Nomor SPK sudah tercatat pada petak ini." };
    if (existingSpk)
      return {
        ok: false,
        message:
          "Petak ini sudah memiliki nomor SPK. Perubahan SPK belum tersedia.",
      };
    submitted = true;
    await auth.request({
      url: `${base}:batchUpdate`,
      method: "POST",
      data: {
        requests: [
          {
            updateCells: {
              start: {
                sheetId,
                rowIndex: plot.spkSourceRow - 1,
                columnIndex: 2,
              },
              rows: [
                { values: [{ userEnteredValue: { stringValue: input.spk } }] },
              ],
              fields: "userEnteredValue",
            },
          },
        ],
      },
      timeout: 15000,
      retry: false,
    });
    const check = (await get(rangeUrl(`C${plot.spkSourceRow}`), {
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
    })) as { values?: unknown[][] };
    if (check.values?.[0]?.[0] !== input.spk)
      throw new Error("Readback mismatch");
    console.info("plot_spk_added", {
      actor,
      worksheet,
      row: plot.spkSourceRow,
      code: input.code,
      at: new Date().toISOString(),
    });
    return { ok: true, message: "Nomor SPK berhasil ditambahkan pada petak." };
  } catch {
    return submitted
      ? {
          ok: false,
          uncertain: true,
          message:
            "Hasil penyimpanan belum dapat dipastikan. Periksa worksheet sebelum mencoba lagi.",
        }
      : {
          ok: false,
          message:
            "SPK belum disimpan. Periksa akses dan struktur worksheet petak.",
        };
  } finally {
    saving = false;
  }
}
