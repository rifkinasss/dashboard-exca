import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { InventoryPlot } from "../types";
import { formatDate, formatNumber } from "../lib/format";

export function PlotSummary({ plots, showAll, onShowAllChange, startDate, endDate, onSelect }: {
  plots: InventoryPlot[];
  showAll: boolean;
  onShowAllChange: (show: boolean) => void;
  startDate: string;
  endDate: string;
  onSelect: (code: string) => void;
}) {
  const visible = showAll ? plots : plots.filter((plot) => plot.includedActivity);
  const statusScope = startDate && endDate && startDate > endDate ? "Rentang tanggal tidak valid" : endDate ?
    `Status hingga ${formatDate(endDate, { day: "numeric", month: "short", year: "numeric" })}` : "Status hingga aktivitas terbaru";
  return (
    <Card className="panel summary-panel" aria-labelledby="summary-title">
      <CardHeader className="panel-heading plot-summary-heading">
        <div><CardTitle id="summary-title">Ringkasan Petak</CardTitle><CardDescription>HM dan efisiensi sesuai filter periode · {statusScope}</CardDescription></div>
        <div className="summary-controls">
          <label className="check-option"><Checkbox checked={showAll} onCheckedChange={onShowAllChange} /> Tampilkan semua petak terdaftar</label>
          <span className="panel-meta">{visible.length} petak</span>
        </div>
      </CardHeader>
      <CardContent className="table-scroll plot-summary-table" tabIndex={0} role="region" aria-label="Tabel ringkasan petak">
        <Table>
          <TableHeader><TableRow>
            <TableHead scope="col">Kode Petak</TableHead><TableHead scope="col" className="num">Luas (Ha)</TableHead>
            <TableHead scope="col" className="num">Hour Meter (Jam)</TableHead><TableHead scope="col" className="num">Efisiensi (L/jam)</TableHead>
            <TableHead scope="col">Status Pekerjaan</TableHead>
          </TableRow></TableHeader>
          <TableBody>{visible.map((plot) => {
            const sources = plot.areaMetadata.sourceRows.map((source) => `${source.worksheet}!D${source.row}`).join(", ");
            const areaNote = `${plot.areaRequiresReview ? "Luas perlu ditinjau. " : ""}${sources ? `Sumber: ${sources}` : "Sumber luas belum tersedia"}`;
            return <TableRow key={plot.code}>
              <th scope="row"><button className="detail-action" onClick={() => onSelect(plot.code)}>{plot.code}</button></th>
              <TableCell className="num"><span className="mobile-column-label" aria-hidden="true">Luas (Ha)</span><span title={areaNote}>{formatNumber(plot.area)}<span className="sr-only"> {areaNote}</span></span></TableCell>
              <TableCell className="num"><span className="mobile-column-label" aria-hidden="true">Hour Meter (Jam)</span>{formatNumber(plot.hours)}</TableCell>
              <TableCell className="num"><span className="mobile-column-label" aria-hidden="true">Efisiensi (L/jam)</span>{formatNumber(plot.efficiency)}</TableCell>
              <TableCell><span className="mobile-column-label" aria-hidden="true">Status Pekerjaan</span><Badge variant="secondary" className="status-label" data-status={plot.status}>{plot.statusAmbiguous ? "Perlu tinjau" : plot.status ?? "Belum diketahui"}</Badge></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </CardContent>
      {!visible.length && <p className="empty-state">Tidak ada petak pada filter ini. Ubah filter atau tampilkan semua petak.</p>}
      <p className="table-footnote">HM dan efisiensi mengikuti filter periode. Status ditampilkan hingga akhir periode; tanpa tanggal akhir, status menggunakan riwayat terbaru.</p>
    </Card>
  );
}
