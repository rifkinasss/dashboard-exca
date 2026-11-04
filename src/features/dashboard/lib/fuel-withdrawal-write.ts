import { planWithdrawalTable } from "./fuel-withdrawal-table";

export type WithdrawalValue = { date: string; plotCode: string; liters: number; price: number };
type Merge = { startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number };
type SheetInfo = { sheetId: number; rowCount: number; merges: Merge[] };

export function createWithdrawalWrite(values: unknown[][], input: WithdrawalValue, sheet: SheetInfo) {
  const headers = values.filter((row) => row[0] === "No" && row[1] === "Tanggal Ambil" && row[2] === "Solar" && row[3] === "No Petak");
  if (!headers.length || headers.some((row) => row[4] !== "Harga Solar" || row[5] !== "Biaya Solar")) return { ok: false as const, reason: "Header tabel belum memuat Harga Solar dan Biaya Solar pada kolom E–F." };
  const cost = input.liters * input.price;
  if (!Number.isFinite(cost) || !Number.isFinite(input.price) || input.price <= 0) return { ok: false as const, reason: "Harga atau biaya solar tidak valid." };
  const plan = planWithdrawalTable(values, input.date);
  if (!plan.ok) return plan;
  const firstRow = plan.kind === "new-month" ? plan.headerRow - 1 : plan.dataRow;
  const lastRow = plan.dataRow;
  if (sheet.merges.some((merge) => (merge.startColumnIndex ?? 0) < 6 && (merge.endColumnIndex ?? 6) > 0 && (merge.startRowIndex ?? 0) < lastRow && (merge.endRowIndex ?? Infinity) > firstRow - 1)) return { ok: false as const, reason: "Area tujuan memiliki sel gabung; perlu ditinjau." };
  const rowValues = [plan.number, Math.round(Date.parse(`${input.date}T00:00:00Z`) / 86400000) + 25569, input.liters, input.plotCode, input.price, cost];
  const cell = (value: string | number) => ({ userEnteredValue: typeof value === "number" ? { numberValue: value } : { stringValue: value } });
  const requests: object[] = [];
  if (lastRow > sheet.rowCount) requests.push({ appendDimension: { sheetId: sheet.sheetId, dimension: "ROWS", length: lastRow - sheet.rowCount } });
  if (plan.kind === "new-month") requests.push({ updateCells: { start: { sheetId: sheet.sheetId, rowIndex: plan.headerRow - 1, columnIndex: 0 }, rows: [{ values: ["No", "Tanggal Ambil", "Solar", "No Petak", "Harga Solar", "Biaya Solar"].map(cell) }], fields: "userEnteredValue" } });
  requests.push({ updateCells: { start: { sheetId: sheet.sheetId, rowIndex: plan.dataRow - 1, columnIndex: 0 }, rows: [{ values: rowValues.map(cell) }], fields: "userEnteredValue" } });
  requests.push({ repeatCell: { range: { sheetId: sheet.sheetId, startRowIndex: plan.dataRow - 1, endRowIndex: plan.dataRow, startColumnIndex: 1, endColumnIndex: 2 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mmm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } });
  return { ok: true as const, firstRow, lastRow, dataRow: plan.dataRow, rowValues, requests };
}
