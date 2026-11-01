import type { RawOverviewRow, WorkStatus } from "../types";

const plots: { code: string; area: number; status: WorkStatus; hours: number }[] = [
  { code: "PTK-01", area: 4.8, status: "Selesai", hours: 7.5 },
  { code: "PTK-02", area: 6.2, status: "Dalam pengerjaan", hours: 8 },
  { code: "PTK-03", area: 3.5, status: "Selesai", hours: 6.5 },
  { code: "PTK-04", area: 5.7, status: "Dalam pengerjaan", hours: 7 },
  { code: "PTK-05", area: 4.1, status: "Ditunda", hours: 5.5 },
  { code: "PTK-06", area: 7.3, status: "Dalam pengerjaan", hours: 8.5 },
  { code: "PTK-07", area: 3.9, status: "Belum mulai", hours: 0 },
  { code: "PTK-08", area: 5.4, status: "Dalam pengerjaan", hours: 6 },
];
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 8, useGrouping: true });

// Synthetic rows in A–P order exercise the same parser as the future sheet source.
export const mockOverview: RawOverviewRow[] = plots.flatMap((plot, index) => {
  let cumulative = 0;
  let meter = 1200 + index * 130;
  return [2, 6, 10, 14, 18, 22, 26, 29].map((day, activity): RawOverviewRow => {
    const hours = plot.hours === 0 ? 0 : plot.hours - (activity % 3) * 0.5;
    const fuel = Math.round(hours * (13 + index * 0.8 + (activity % 2)));
    const start = meter;
    meter += hours;
    cumulative += fuel;
    const missing = index === 4 && activity === 3;
    return [
      index * 8 + activity + 1, `SPK-${String(index + 1).padStart(3, "0")}`, plot.code, number.format(plot.area), number.format(cumulative),
      `${String(day).padStart(2, "0")}/10/2026`, number.format(start), number.format(meter), number.format(hours), 65,
      activity % 2 === 0 && hours > 0 ? 250 : 0,
      missing || hours === 0 ? "" : number.format(fuel / hours), missing ? "" : fuel,
      hours === 0 ? 100 : 320 - fuel,
      activity === 7 ? plot.status : plot.hours === 0 ? "Belum mulai" : "Dalam pengerjaan",
      missing ? "Contoh pengukuran solar belum tersedia" : "Data sintetis untuk demonstrasi",
    ];
  });
});
