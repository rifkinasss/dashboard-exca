import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitCompareArrows } from "lucide-react";
import type { DataQualityIssue, InventoryPlot, ValidatedOverviewRecord } from "../types";
import { measurement } from "../lib/calculate-kpis";
import { plotDetails } from "../lib/interactive-monitoring";
import { formatDate, formatNumber } from "../lib/format";

export function PlotDetail({ plot, allRows, periodRows, issues, onClose }: { plot: InventoryPlot; allRows: ValidatedOverviewRecord[]; periodRows: ValidatedOverviewRecord[]; issues: DataQualityIssue[]; onClose: () => void }) {
  const detail = plotDetails(plot.code, allRows, periodRows);
  const sourceRows = new Set(allRows.filter(({ record }) => record.plotCode === plot.code).map(({ record }) => record.source.row));
  const relevant = issues.filter((issue) => sourceRows.has(issue.source.row));
  const displayDate = (date: string | null) => date ? formatDate(date) : "N/A";
  return <section className="panel summary-panel" aria-labelledby="detail-title">
    <div className="panel-heading"><div><h2 id="detail-title">Detail petak {plot.code}</h2><p>Pengukuran dan riwayat mengikuti filter dashboard; pilih semua tanggal untuk melihat seluruh aktivitas bertanggal.</p></div><button className="detail-action" onClick={onClose}>Tutup detail</button></div>
    <div className="detail-grid">
      <div>Luas <strong>{formatNumber(plot.area)} Ha</strong></div><div>Status hingga akhir periode <strong>{plot.statusAmbiguous ? "Perlu tinjau" : plot.status ?? "Belum diketahui"}</strong></div>
      <div>Status terbaru seluruh sumber <strong>{detail.latest.ambiguous ? "Perlu tinjau" : detail.latest.status ?? "Belum diketahui"}</strong></div>
      <div>Aktivitas pertama · seluruh sumber <strong>{displayDate(detail.firstDate)}</strong></div><div>Aktivitas terakhir · seluruh sumber <strong>{displayDate(detail.lastDate)}</strong></div>
      <div>Solar riil periode <strong>{formatNumber(detail.metrics.fuel)} L</strong></div><div>HM periode <strong>{formatNumber(detail.metrics.hours)} jam</strong></div><div>Efisiensi pasangan valid <strong>{formatNumber(detail.metrics.efficiency)} L/jam</strong></div>
    </div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`Riwayat aktivitas ${plot.code}`}><table><thead><tr><th>Tanggal / sumber</th><th>HM awal</th><th>HM akhir</th><th>HM kerja</th><th>Pengisian L</th><th>Solar L/jam sumber</th><th>Solar riil L</th><th>Stok L</th><th>Status baris</th><th>Keterangan</th></tr></thead><tbody>
      {detail.activity.map((row) => <tr key={row.record.source.row}><th scope="row">{displayDate(row.record.date)}<br />{row.record.source.worksheet}!{row.record.source.row}</th>{(["hmStart", "hmEnd", "workingHours", "fuelRefill", "fuelPerHour", "actualFuelUsage", "remainingFuel"] as const).map((field) => <td key={field}>{formatNumber(measurement(row, field))}{row.invalidFields.includes(field) ? " (tidak valid)" : ""}</td>)}<td>{row.record.workStatus ?? "Belum diketahui"}</td><td>{row.record.notes ?? "—"}</td></tr>)}
    </tbody></table></div>
    {!detail.activity.length && <p className="empty-state">Tidak ada aktivitas bertanggal yang cocok dengan filter.</p>}
    <details><summary className="table-footnote">Kualitas data seluruh sumber · {relevant.length} temuan</summary><ul className="detail-issues">{relevant.map((issue, index) => <li key={`${issue.source.row}-${issue.code}-${index}`}>{issue.source.worksheet}!{issue.source.row}: {issue.message}</li>)}</ul></details>
  </section>;
}

export function PlotComparison({ plots, allRows, periodRows }: { plots: InventoryPlot[]; allRows: ValidatedOverviewRecord[]; periodRows: ValidatedOverviewRecord[] }) {
  return <Card className="panel summary-panel comparison-panel" aria-labelledby="comparison-title">
    <CardHeader className="comparison-header"><div className="comparison-heading"><span className="comparison-icon"><GitCompareArrows aria-hidden="true" /></span><div><CardTitle id="comparison-title">Perbandingan petak</CardTitle><CardDescription>Bandingkan aktivitas petak sesuai filter periode.</CardDescription></div></div><span className="panel-meta">{plots.length} petak dipilih</span></CardHeader>
    <CardContent className="comparison-content">
      {plots.length < 2 ? <div className="comparison-empty"><strong>Belum ada perbandingan</strong><p>Pilih minimal dua kode petak pada dropdown di filter untuk melihat perbandingan solar, HM, dan efisiensi.</p></div> : <>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Perbandingan petak"><Table><TableHeader><TableRow><TableHead scope="col">Kode Petak</TableHead><TableHead scope="col">Solar riil (L)</TableHead><TableHead scope="col">HM (jam)</TableHead><TableHead scope="col">Efisiensi (L/jam)</TableHead><TableHead scope="col">Aktivitas</TableHead><TableHead scope="col">Kelengkapan data</TableHead></TableRow></TableHeader><TableBody>{plots.map((plot) => {
          const detail = plotDetails(plot.code, allRows, periodRows);
          return <TableRow key={plot.code}><th scope="row">{plot.code}</th><TableCell><span className="mobile-column-label" aria-hidden="true">Solar riil (L)</span>{formatNumber(detail.metrics.fuel)}</TableCell><TableCell><span className="mobile-column-label" aria-hidden="true">HM (jam)</span>{formatNumber(detail.metrics.hours)}</TableCell><TableCell><span className="mobile-column-label" aria-hidden="true">Efisiensi (L/jam)</span>{formatNumber(detail.comparableEfficiency)}</TableCell><TableCell><span className="mobile-column-label" aria-hidden="true">Aktivitas</span>{detail.activity.length}</TableCell><TableCell><span className="mobile-column-label" aria-hidden="true">Kelengkapan data</span>{!detail.activity.length ? "Tidak ada aktivitas" : detail.comparableEfficiency === null ? "Data tidak cukup untuk efisiensi" : "Pasangan pengukuran tersedia"}</TableCell></TableRow>;
        })}</TableBody></Table></div>
        <p className="table-footnote">Efisiensi dihitung dari pasangan pengukuran yang valid; L/jam tidak menunjukkan produktivitas secara langsung.</p>
      </>}
    </CardContent>
  </Card>;
}
