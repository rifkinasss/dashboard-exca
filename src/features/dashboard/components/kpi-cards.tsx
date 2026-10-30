import { Blocks, Fuel, Hourglass, Gauge, Map } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "../types";
import { formatNumber } from "../lib/format";

export function KpiCards({ totals, registeredCount, workedArea }: { totals: DashboardSummary["totals"]; registeredCount: number; workedArea: { value: number | null; unavailableCount: number; zeroCount: number } }) {
  const metrics = [
    { icon: Blocks, label: "Total Petak Terdaftar", value: registeredCount, unit: "petak", note: "Seluruh kode pada sumber" },
    { icon: Fuel, label: "Total Solar Masuk", value: totals.refill, unit: "L", note: "Akumulasi pengisian" },
    { icon: Hourglass, label: "Total HM Kerja", value: totals.hours, unit: "jam", note: "Akumulasi jam operasional" },
    { icon: Gauge, label: "Rata-rata Konsumsi", value: totals.efficiency, unit: "L/jam", note: "Solar riil ÷ HM berpasangan" },
    { icon: Map, label: "Total Luas Petak Digarap", value: workedArea.value, unit: "ha", note: workedArea.value === null ? "Belum ada luas yang dapat dijumlahkan" : workedArea.unavailableCount ? `Jumlah parsial · ${workedArea.unavailableCount} petak perlu ditinjau` : workedArea.zeroCount ? `${workedArea.zeroCount} petak tercatat 0 ha · perlu ditinjau` : "Luas petak aktif sesuai filter" },
  ];
  return <section className="kpi-grid" aria-label="Indikator utama">{metrics.map((metric) => <Card className="kpi-card" key={metric.label}><span className="kpi-icon"><metric.icon size={26} strokeWidth={2.2} aria-hidden="true" /></span><div><CardHeader><CardTitle>{metric.label}</CardTitle></CardHeader><CardContent><p className="kpi-value">{formatNumber(metric.value)} <span>{metric.unit}</span></p><CardDescription className="kpi-note">{metric.note}</CardDescription></CardContent></div></Card>)}</section>;
}
