import { Button } from "@/components/ui/button";
import type {
  InventoryPlot,
  ValidatedOverviewRecord,
} from "../types";
import { measurement } from "../lib/calculate-kpis";
import { plotDetails } from "../lib/interactive-monitoring";
import { formatDate, formatNumber } from "../lib/format";
import { calculatePlotPrice, type PlotPrice } from "../../management/lib/plot-price";
import type { PlotSheetSummary } from "../../management/lib/plot-sheet";

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });
const summaryNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const displayMoney = (value: number | null) => value === null ? "Belum tersedia" : rupiah.format(value);
const displayMeasurement = (value: number | null, unit: string) => value === null ? "Belum tersedia" : `${summaryNumber.format(value)} ${unit}`;

export function PlotDetail({
  plot,
  allRows,
  periodRows,
  plotPrices,
  plotSheetSummaries,
  onClose,
}: {
  plot: InventoryPlot;
  allRows: ValidatedOverviewRecord[];
  periodRows: ValidatedOverviewRecord[];
  plotPrices: PlotPrice[] | null;
  plotSheetSummaries: PlotSheetSummary[];
  onClose: () => void;
}) {
  const { activity } = plotDetails(plot.code, allRows, periodRows);
  const spks = [...new Set(allRows.flatMap(({ record, duplicateOf }) =>
    record.plotCode === plot.code && duplicateOf === null && record.spkNumber ? [record.spkNumber] : [],
  ))];
  const matchingBlocks = plotSheetSummaries.filter((summary) =>
    summary.code.toUpperCase() === plot.code.toUpperCase() &&
    (!spks.length || !summary.spk || spks.includes(summary.spk)),
  );
  const sheet = matchingBlocks.length === 1 ? matchingBlocks[0] : null;
  const area = sheet?.area ?? plot.area;
  const totalFuel = sheet ? sheet.totalFuelConsumption : plot.cumulativeFuelMetadata.value;
  const fallbackPrice = sheet ? null : calculatePlotPrice(plotPrices, { ...plot, spks });
  const summary = [
    ["No. SPK", sheet?.spk ?? (spks.join(", ") || "Belum tersedia")],
    ["Kode Petak", plot.code],
    ["Harga Petak / Ha", displayMoney(sheet?.pricePerHa ?? fallbackPrice?.pricePerHa ?? null)],
    ["Total Nilai Petak", displayMoney(sheet?.totalValue ?? fallbackPrice?.amount ?? null)],
    ["Luas Petak", displayMeasurement(area, "Ha")],
    ["Total Konsumsi Solar", displayMeasurement(totalFuel === null ? null : Math.round(totalFuel), "L")],
  ];
  const displayDate = (date: string | null) =>
    date ? formatDate(date) : "N/A";
  return (
    <section className="panel summary-panel" aria-labelledby="detail-title">
      <div className="panel-heading">
        <div>
          <h2 id="detail-title">Detail petak {plot.code}</h2>
          <p>
            Riwayat aktivitas mengikuti filter dashboard.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onClose}>
          Tutup detail
        </Button>
      </div>
      <dl className="detail-grid">
        {summary.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={`Riwayat aktivitas ${plot.code}`}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Tanggal</th>
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
            {activity.map((row) => (
              <tr key={row.record.source.row}>
                <th scope="row">{displayDate(row.record.date)}</th>
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
      {!activity.length && (
        <p className="empty-state">
          Tidak ada aktivitas bertanggal yang cocok dengan filter.
        </p>
      )}
    </section>
  );
}
