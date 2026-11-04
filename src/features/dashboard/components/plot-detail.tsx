import type {
  DataQualityIssue,
  InventoryPlot,
  ValidatedOverviewRecord,
} from "../types";
import { measurement } from "../lib/calculate-kpis";
import { plotDetails } from "../lib/interactive-monitoring";
import { formatDate, formatNumber } from "../lib/format";

export function PlotDetail({
  plot,
  allRows,
  periodRows,
  issues,
  onClose,
}: {
  plot: InventoryPlot;
  allRows: ValidatedOverviewRecord[];
  periodRows: ValidatedOverviewRecord[];
  issues: DataQualityIssue[];
  onClose: () => void;
}) {
  const detail = plotDetails(plot.code, allRows, periodRows);
  const sourceRows = new Set(
    allRows
      .filter(({ record }) => record.plotCode === plot.code)
      .map(({ record }) => record.source.row),
  );
  const relevant = issues.filter((issue) => sourceRows.has(issue.source.row));
  const displayDate = (date: string | null) =>
    date ? formatDate(date) : "N/A";
  return (
    <section className="panel summary-panel" aria-labelledby="detail-title">
      <div className="panel-heading">
        <div>
          <h2 id="detail-title">Detail petak {plot.code}</h2>
          <p>
            Pengukuran dan riwayat mengikuti filter dashboard; pilih semua
            tanggal untuk melihat seluruh aktivitas bertanggal.
          </p>
        </div>
        <button className="detail-action" onClick={onClose}>
          Tutup detail
        </button>
      </div>
      <div className="detail-grid">
        <div>
          Luas <strong>{formatNumber(plot.area)} Ha</strong>
        </div>
        <div>
          Status hingga akhir periode{" "}
          <strong>
            {plot.statusAmbiguous
              ? "Perlu tinjau"
              : (plot.status ?? "Belum diketahui")}
          </strong>
        </div>
        <div>
          Status terbaru dalam cakupan SPK{" "}
          <strong>
            {detail.latest.ambiguous
              ? "Perlu tinjau"
              : (detail.latest.status ?? "Belum diketahui")}
          </strong>
        </div>
        <div>
          Aktivitas pertama · cakupan SPK{" "}
          <strong>{displayDate(detail.firstDate)}</strong>
        </div>
        <div>
          Aktivitas terakhir · cakupan SPK{" "}
          <strong>{displayDate(detail.lastDate)}</strong>
        </div>
        <div>
          Solar riil periode{" "}
          <strong>{formatNumber(detail.metrics.fuel)} L</strong>
        </div>
        <div>
          HM periode <strong>{formatNumber(detail.metrics.hours)} jam</strong>
        </div>
        <div>
          Efisiensi pasangan valid{" "}
          <strong>{formatNumber(detail.metrics.efficiency)} L/jam</strong>
        </div>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={`Riwayat aktivitas ${plot.code}`}
      >
        <table>
          <thead>
            <tr>
              <th>Tanggal / sumber</th>
              <th>No. SPK</th>
              <th>HM awal</th>
              <th>HM akhir</th>
              <th>HM kerja</th>
              <th>Pengisian L</th>
              <th>Solar L/jam sumber</th>
              <th>Solar riil L</th>
              <th>Status baris</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {detail.activity.map((row) => (
              <tr key={row.record.source.row}>
                <th scope="row">
                  {displayDate(row.record.date)}
                  <br />
                  {row.record.source.worksheet}!{row.record.source.row}
                  {row.record.plotCodeSource &&
                    row.record.plotCodeSource.row !== row.record.source.row && (
                      <>
                        <br />
                        <span>
                          Kode petak: C{row.record.plotCodeSource.row} (sel
                          gabungan)
                        </span>
                      </>
                    )}
                  {row.record.spkSource &&
                    row.record.spkSource.row !== row.record.source.row && (
                      <>
                        <br />
                        <span>
                          SPK: B{row.record.spkSource.row} (sel gabungan)
                        </span>
                      </>
                    )}
                </th>
                <td>{row.record.spkNumber ?? "N/A"}</td>
                {(
                  [
                    "hmStart",
                    "hmEnd",
                    "workingHours",
                    "fuelRefill",
                    "fuelPerHour",
                    "actualFuelUsage",
                  ] as const
                ).map((field) => (
                  <td key={field}>
                    {formatNumber(measurement(row, field))}
                    {row.invalidFields.includes(field) ? " (tidak valid)" : ""}
                  </td>
                ))}
                <td>{row.record.workStatus ?? "Belum diketahui"}</td>
                <td>{row.record.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!detail.activity.length && (
        <p className="empty-state">
          Tidak ada aktivitas bertanggal yang cocok dengan filter.
        </p>
      )}
      <details>
        <summary className="table-footnote">
          Kualitas data dalam cakupan SPK · {relevant.length} temuan
        </summary>
        <ul className="detail-issues">
          {relevant.map((issue, index) => (
            <li key={`${issue.source.row}-${issue.code}-${index}`}>
              {issue.source.worksheet}!{issue.source.row}: {issue.message}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
