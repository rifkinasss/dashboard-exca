import { Blocks, Droplets, Fuel, Hourglass, Gauge, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MONTHLY_AREA_TARGET_HA } from "../config/monthly-target";
import type { DashboardSummary } from "../types";
import type { calculateMonthlyAreaTarget } from "../lib/monthly-area-target";
import { formatDate, formatNumber } from "../lib/format";

export function KpiCards({ totals, withdrawals, workedArea, averageFuelPerHour, monthlyTarget, spkFiltered }: { workedArea: { value: number | null; unavailableCount: number }; averageFuelPerHour: number | null; withdrawals: { value: number | null; note: string }; totals: DashboardSummary["totals"]; monthlyTarget: ReturnType<typeof calculateMonthlyAreaTarget>; spkFiltered: boolean }) {
  const metrics = [
    { icon: Blocks, label: "Luas Petak Dikerjakan", value: workedArea.value, unit: "Ha", note: `${totals.plotCount} petak dikerjakan${workedArea.unavailableCount > 0 ? ` · ${workedArea.unavailableCount} luas belum tersedia` : ""}` },
    { icon: Droplets, label: "Total Pengambilan Solar", value: withdrawals.value, unit: "L", note: withdrawals.note },
    { icon: Fuel, label: "Total Pengisian Solar", value: totals.refill, unit: "L", note: "Akumulasi pengisian" },
    { icon: Hourglass, label: "Total HM Kerja", value: totals.hours, unit: "jam", note: "Akumulasi jam operasional" },
    { icon: Gauge, label: "Rata-rata Konsumsi Solar", value: averageFuelPerHour, unit: "L/jam", note: "Rata-rata pengukuran dalam periode" },
  ];
  return <section className="kpi-grid" aria-label="Indikator utama">
    {metrics.map((metric) => <Card className="kpi-card" key={metric.label}><span className="kpi-icon"><metric.icon size={26} strokeWidth={2.2} aria-hidden="true" /></span><div><CardHeader><CardTitle>{metric.label}</CardTitle></CardHeader><CardContent><p className="kpi-value">{formatNumber(metric.value)} <span>{metric.unit}</span></p><CardDescription className="kpi-note">{metric.note}</CardDescription></CardContent></div></Card>)}
    <Card className="kpi-card target-card"><span className="kpi-icon"><Target size={26} strokeWidth={2.2} aria-hidden="true" /></span><div className="target-content"><CardHeader><CardTitle>Target Luas Petak</CardTitle></CardHeader><CardContent>
      {monthlyTarget.month && monthlyTarget.completedAreaHa !== null && monthlyTarget.achievementPercentage !== null && monthlyTarget.remainingAreaHa !== null ? <>
        <p className="target-percentage">{formatNumber(monthlyTarget.achievementPercentage)}%</p>
        <p className="target-value">{formatNumber(monthlyTarget.completedAreaHa)} / {formatNumber(MONTHLY_AREA_TARGET_HA)} Ha</p>
        <progress max={100} value={Math.min(100, monthlyTarget.achievementPercentage)} aria-label={`Capaian target ${formatDate(`${monthlyTarget.month}-01`, { month: "long", year: "numeric" })}`} aria-valuetext={`${formatNumber(monthlyTarget.achievementPercentage)} persen`} />
        <CardDescription className="kpi-note">Sisa target: {formatNumber(monthlyTarget.remainingAreaHa)} Ha{spkFiltered ? " · kontribusi SPK terpilih terhadap target bulanan" : ""}</CardDescription>
        {monthlyTarget.issues.length > 0 && <p className="target-warning">{monthlyTarget.issues.length} petak belum dapat dihitung</p>}
      </> : <><p className="target-percentage">{formatNumber(MONTHLY_AREA_TARGET_HA)} <span className="target-unit">Ha / bulan</span></p><CardDescription className="target-prompt">Pilih satu bulan penuh untuk melihat capaian.</CardDescription></>}
    </CardContent></div></Card>
  </section>;
}
