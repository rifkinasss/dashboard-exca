import "server-only";
import { JWT } from "google-auth-library";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import {
  isPlotFinished,
  isPlot2026Date,
  parsePlotSheet,
  plotActivityAverageIndex,
  plotActivityHeaderIndex,
  plotActivityTotalIndex,
  plot2026Worksheet,
  plotSheetRange,
} from "../../lib/plot-sheet";
import { plotWorksheetName } from "./plot-sheet-source";

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
    const headers = [
      "No",
      "Tanggal",
      "HM Awal",
      "HM Akhir",
      "HM Kerja (Jam)",
      "Est. Jam Kerja",
      "Pengisian Solar (L)",
      "Pemakaian Solar per Jam (L/Hr)",
      "Pemakaian Solar Riil (L)",
      "Sisa/Stok Tangki (L)",
      "Status Pekerjaan",
      "Keterangan",
    ];
    if (!headers.every((header, col) => rows[headerIndex]?.[col] === header))
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
    if (extendTable && isPlotFinished(plot.activities))
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
    const activityHeaders = [
      "No",
      "Tanggal",
      "HM Awal",
      "HM Akhir",
      "HM Kerja (Jam)",
      "Est. Jam Kerja",
      "Pengisian Solar (L)",
      "Pemakaian Solar per Jam (L/Hr)",
      "Pemakaian Solar Riil (L)",
      "Sisa/Stok Tangki (L)",
      "Status Pekerjaan",
      "Keterangan",
    ];
    if (
      templateRows.length < 16 ||
      templateRows[0]?.[0] !== "No. SPK" ||
      templateRows[1]?.[0] !== "Kode Petak" ||
      templateRows[2]?.[0] !== "Harga Petak / Ha" ||
      templateRows[3]?.[0] !== "Total Nilai Petak" ||
      templateRows[4]?.[0] !== "Luas Petak" ||
      templateRows[5]?.[0] !== "Total Konsumsi Solar" ||
      !activityHeaders.every(
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
