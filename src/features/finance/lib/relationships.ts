import type { ValidatedOverviewRecord } from "../../dashboard/types";
import type { FinanceIssue, FinanceRecord } from "../types";

type Pair = { spk: string; plot: string; rows: ValidatedOverviewRecord[] };
const key = (spk: string, plot: string) => JSON.stringify([spk, plot]);
export function relateFinance(records: readonly FinanceRecord[], operations: readonly ValidatedOverviewRecord[]) {
  const issues: FinanceIssue[] = [];
  const pairs = new Map<string, Pair>();
  for (const row of operations) {
    const { spkNumber: spk, plotCode: plot } = row.record;
    if (!spk || !plot || row.duplicateOf !== null) continue;
    const k = key(spk, plot), pair = pairs.get(k) ?? { spk, plot, rows: [] };
    pair.rows.push(row); pairs.set(k, pair);
  }
  for (const [plot, group] of Map.groupBy([...pairs.values()], (pair) => pair.plot)) if (group.length > 1) issues.push({ code: "multiple_spk_per_plot", worksheet: group[0].rows[0].record.source.worksheet, row: group[0].rows[0].record.source.row, message: `Petak ${plot} memiliki lebih dari satu SPK operasional.`, relatedRows: group.flatMap((pair) => pair.rows.map((row) => row.record.source.row)) });
  const byPlot = Map.groupBy(records.filter((record) => record.plot), (record) => record.plot!);
  const candidates = records.map((record) => {
    let pair = record.spk && record.plot ? pairs.get(key(record.spk, record.plot)) : undefined;
    if (!record.spk && record.plot) {
      const matching = [...pairs.values()].filter((item) => item.plot === record.plot);
      if (matching.length === 1 && byPlot.get(record.plot)?.length === 1) pair = matching[0];
      else issues.push({ code: "ambiguous_relationship", worksheet: record.worksheet, row: record.row, message: "SPK kosong dan petak tidak memiliki pasangan tunggal yang aman." });
    }
    if (record.spk && record.plot && !pair) issues.push({ code: "unmatched_finance", worksheet: record.worksheet, row: record.row, message: `Tidak ada aktivitas operasional untuk ${record.spk} / ${record.plot}.` });
    return { record, pair };
  });
  const byPair = Map.groupBy(candidates.filter((entry) => entry.pair), (entry) => key(entry.pair!.spk, entry.pair!.plot));
  for (const entries of byPair.values()) if (entries.length > 1) for (const entry of entries) issues.push({ code: "duplicate_finance_key", worksheet: entry.record.worksheet, row: entry.record.row, relatedRows: entries.map((item) => item.record.row), message: "Lebih dari satu baris keuangan memiliki pasangan SPK dan petak yang sama; seluruhnya dikecualikan dari total." });
  const matched = candidates.filter((entry): entry is { record: FinanceRecord; pair: Pair } => Boolean(entry.pair) && byPair.get(key(entry.pair!.spk, entry.pair!.plot))?.length === 1);
  const matchedKeys = new Set(matched.map(({ pair }) => key(pair.spk, pair.plot)));
  for (const pair of pairs.values()) if (!matchedKeys.has(key(pair.spk, pair.plot))) issues.push({ code: "unmatched_operation", worksheet: pair.rows[0].record.source.worksheet, row: pair.rows[0].record.source.row, relatedRows: pair.rows.map((row) => row.record.source.row), message: `Tidak ada pasangan keuangan yang unik untuk ${pair.spk} / ${pair.plot}.` });
  for (const { record } of operations) if (record.plotCode && !record.spkNumber) issues.push({ code: "operation_missing_spk", worksheet: record.source.worksheet, row: record.source.row, message: "Aktivitas operasional tanpa SPK tidak dapat dipasangkan secara pasti." });
  return { matched, issues, pairs: [...pairs.values()] };
}
