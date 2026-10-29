import { Blocks, ClipboardCheck, Fuel, Droplets, Hourglass, Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "../types";
import { formatNumber } from "../lib/format";

export function KpiCards({ totals, registeredCount }: { totals: DashboardSummary["totals"]; registeredCount: number }) {
  const metrics = [
    { icon: Blocks, label: "Total Petak Terdaftar", value: registeredCount, unit: "petak", note: "Seluruh kode pada sumber" },
    { icon: ClipboardCheck, label: "Petak dengan Aktivitas dalam Periode", value: totals.plotCount, unit: "petak", note: totals.area === null ? "Luas petak aktif belum pasti" : `${formatNumber(totals.area)} ha · metadata seluruh sumber` },
    { icon: Fuel, label: "Total Solar Masuk", value: totals.refill, unit: "L", note: "Akumulasi pengisian" },
    { icon: Droplets, label: "Total Pemakaian Riil", value: totals.fuel, unit: "L", note: "Pengukuran solar tersedia" },
    { icon: Hourglass, label: "Total HM Kerja", value: totals.hours, unit: "jam", note: "Akumulasi jam operasional" },
    { icon: Gauge, label: "Rata-rata Konsumsi", value: totals.efficiency, unit: "L/jam", note: "Solar riil ÷ HM berpasangan" },
  ];
  return <section className="kpi-grid" aria-label="Indikator utama">{metrics.map((metric) => <Card className="kpi-card" key={metric.label}><span className="kpi-icon"><metric.icon size={26} strokeWidth={2.2} aria-hidden="true" /></span><div><CardHeader><CardTitle>{metric.label}</CardTitle></CardHeader><CardContent><p className="kpi-value">{formatNumber(metric.value)} <span>{metric.unit}</span></p><CardDescription className="kpi-note">{metric.note}</CardDescription></CardContent></div></Card>)}</section>;
}
