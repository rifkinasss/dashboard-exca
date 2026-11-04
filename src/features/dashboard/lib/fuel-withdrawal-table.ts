import { parseFuelWithdrawals } from "./fuel-withdrawals";
import { validDate } from "./normalize-overview";

const header = ["No", "Tanggal Ambil", "Solar", "No Petak"];
const isHeader = (row: unknown[]) => header.every((value, index) => row[index] === value);
const isBlank = (row: unknown[]) => row.every((value) => value === null || value === undefined || value === "");

/** Plans only; row selection must be revalidated by a future authenticated writer. */
export function planWithdrawalTable(values: unknown[][], date: string) {
  if (!validDate(date)) return { ok: false as const, reason: "Tanggal pengambilan tidak valid." };
  if (!values.length || !isHeader(values[0])) return { ok: false as const, reason: "Header worksheet tidak sesuai." };
  const parsed = parseFuelWithdrawals(values);
  if (parsed.invalidRows.length) return { ok: false as const, reason: "Ada baris sumber yang perlu ditinjau." };
  const starts = values.map((row, index) => isHeader(row) ? index : -1).filter((index) => index >= 0);
  const blocks = starts.map((start, index) => {
    const end = starts[index + 1] ?? values.length;
    const records = parsed.records.filter((record) => record.sourceRow >= start + 5 && record.sourceRow < end + 4);
    return { start, end, months: [...new Set(records.map((record) => record.date.slice(0, 7)))] };
  });
  if (blocks.some((block) => block.months.length !== 1)) return { ok: false as const, reason: "Bulan tabel kosong atau bercampur; perlu ditinjau." };
  const matches = blocks.filter((block) => block.months[0] === date.slice(0, 7));
  if (matches.length > 1) return { ok: false as const, reason: "Ada lebih dari satu tabel untuk bulan ini." };
  if (!matches.length) {
    const last = values.findLastIndex((row) => !isBlank(row));
    return { ok: true as const, kind: "new-month" as const, headerRow: last + 6, dataRow: last + 7, number: 1 };
  }
  const block = matches[0];
  const rows = values.slice(block.start + 1, block.end);
  const occupied = rows.findLastIndex((row) => !isBlank(row));
  const nextIndex = block.start + occupied + 2;
  const numbers = rows.filter((row) => !isBlank(row)).map((row) => row[0]);
  if (numbers.some((number) => typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) || new Set(numbers).size !== numbers.length) return { ok: false as const, reason: "Nomor transaksi pada tabel tidak valid atau duplikat." };
  if (nextIndex >= block.end && block.end !== values.length) return { ok: false as const, reason: "Tidak ada baris kosong sebelum tabel bulan berikutnya." };
  return { ok: true as const, kind: "existing-month" as const, dataRow: nextIndex + 4, number: Math.max(...numbers as number[]) + 1 };
}
