import { useState } from "react";
import { filterQuality } from "../lib/interactive-monitoring";
import { overviewColumns, type DataQualityIssue, type OverviewRecord } from "../types";

const severityLabels = { info: "Informasi", warning: "Peringatan", error: "Kesalahan" };

export function DataQuality({ issues, records }: { issues: DataQualityIssue[]; records: OverviewRecord[] }) {
  const [filters, setFilters] = useState({ severity: "", plot: "", row: "", code: "" });
  const visible = filterQuality(issues, records, filters);
  const plots = [...new Set(records.map((record) => record.plotCode).filter(Boolean))].sort();
  const codes = [...new Set(issues.map((issue) => issue.code))].sort();
  const byRow = new Map(records.map((record) => [record.source.row, record]));
  return (
    <details className="panel summary-panel">
      <summary className="panel-heading">
        <h2>Kualitas data · {issues.length} temuan</h2>
        <span className="panel-meta">Buka rincian</span>
      </summary>
      <p className="table-footnote">Seluruh data sebelum filter. Nilai sumber disimpan; hanya metrik terkait yang dikecualikan. N/A dapat berarti belum terukur atau memerlukan tinjauan.</p>
      <div className="quality-filters">
        <label>Tingkat <select value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}><option value="">Semua</option>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Petak <select value={filters.plot} onChange={(event) => setFilters({ ...filters, plot: event.target.value })}><option value="">Semua</option>{plots.map((code) => <option key={code}>{code}</option>)}</select></label>
        <label>Baris sumber <input type="number" min="1" value={filters.row} onChange={(event) => setFilters({ ...filters, row: event.target.value })} /></label>
        <label>Jenis temuan <select value={filters.code} onChange={(event) => setFilters({ ...filters, code: event.target.value })}><option value="">Semua</option>{codes.map((code) => <option key={code} value={code}>{code.replaceAll("_", " ")}</option>)}</select></label>
        <span>{visible.length} temuan</span>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Rincian kualitas data">
        <table>
          <thead><tr><th scope="col">Tingkat</th><th scope="col">Sumber</th><th scope="col">Nilai mentah</th><th scope="col">Temuan</th></tr></thead>
          <tbody>{visible.map((issue, index) => {
            const columnIndex = overviewColumns.findIndex((column) => column.field === issue.field);
            const value = byRow.get(issue.source.row)?.raw[columnIndex];
            return (
              <tr key={`${issue.source.row}-${issue.code}-${index}`}>
                <td>{severityLabels[issue.severity]}</td>
                <th scope="row">{issue.source.worksheet}!{overviewColumns[columnIndex]?.column}{issue.source.row}</th>
                <td>{value === null || value === undefined || value === "" ? "(kosong)" : String(value)}</td>
                <td>{issue.message}{issue.relatedRows?.length ? ` Baris terkait: ${issue.relatedRows.join(", ")}.` : ""}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {!visible.length && <p className="empty-state">Tidak ada temuan pada aturan validasi saat ini.</p>}
    </details>
  );
}
