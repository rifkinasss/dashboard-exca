"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ChartNoAxesCombined, Settings, Hourglass, Fuel } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DashboardSummary, InventoryPlot, ValidatedOverviewRecord } from "../types";
import { fuelByPlot, monitoringTrend } from "../lib/interactive-monitoring";
import { formatDate, formatNumber } from "../lib/format";
import { fuelWithdrawalDifference } from "../lib/fuel-withdrawals";

const orange = "var(--primary)";
const axis = { tickLine: false, axisLine: false, tick: { fill: "#64748B", fontSize: 12 } };
const tooltipStyle = { border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#334155" };
const subscribe = () => () => {};
const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const getServerReducedMotion = () => true;
const chartTitles = [
  "Konsumsi Solar per Petak", "Tren Pemakaian Solar Harian", "Status Pekerjaan",
  "Efisiensi Solar per Petak", "Jam Kerja per Petak", "Total Pengisian vs Total Konsumsi Solar per Petak",
];

function ChartPanel({ title, description, children, empty, className = "" }: {
  title: string;
  description: string;
  children: ReactNode;
  empty: boolean;
  className?: string;
}) {
  return (
    <Card className={`panel chart-panel ${className}`} aria-label={title}>
      <CardHeader className="panel-heading"><div className="chart-heading">{title === chartTitles[0] ? <BarChart3 aria-hidden="true" /> : title === chartTitles[3] ? <Settings aria-hidden="true" /> : <Hourglass aria-hidden="true" />}<div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div></div></CardHeader>
      <CardContent className="chart-area">
        {empty ? <p className="empty-chart">Tidak ada pengukuran pada filter ini.</p> : children}
      </CardContent>
    </Card>
  );
}

export function Charts({ summary, rows, inventory, summaryPanel, withdrawals }: { summary: DashboardSummary; rows: ValidatedOverviewRecord[]; inventory: InventoryPlot[]; summaryPanel: ReactNode; withdrawals: { value: number | null; note: string } }) {
  const [interval, setInterval] = useState<"daily" | "weekly">("daily");
  const trend = useMemo(() => monitoringTrend(rows, interval), [rows, interval]);
  const fuelComparison = useMemo(() => fuelByPlot(rows, inventory), [rows, inventory]);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, getServerReducedMotion);
  if (!mounted) {
    return (
      <div className="chart-grid" role="status" aria-label="Menyiapkan grafik">
        {Array.from({ length: 5 }, (_, index) => <section className="panel chart-panel" key={index} aria-hidden="true">
          <Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-chart-body" />
        </section>)}
        {summaryPanel}
      </div>
    );
  }
  const plots = summary.plots;
  return (
    <div className="chart-grid">
      <ChartPanel title={chartTitles[0]} description="Pemakaian riil · liter" empty={!plots.some((plot) => plot.fuel !== null)} className="chart-wide operational-consumption">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={plots} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 4" />
            <XAxis dataKey="code" {...axis} tickMargin={10} />
            <YAxis {...axis} width={46} tickFormatter={formatNumber} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#FFF7ED" }} formatter={(value) => [`${formatNumber(typeof value === "number" ? value : null)} L`, "Solar riil"]} />
            <Bar dataKey="fuel" fill={orange} maxBarSize={34} radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
      <Card className="panel chart-panel chart-wide operational-trend" aria-label={chartTitles[1]}>
        <div className="panel-heading"><div className="chart-heading"><ChartNoAxesCombined aria-hidden="true" /><div><h2>{chartTitles[1]}</h2><p>Solar riil (L) dan HM (jam) · petak sesuai filter</p></div></div><label>Interval <select value={interval} onChange={(event) => setInterval(event.target.value as "daily" | "weekly")}><option value="daily">Harian</option><option value="weekly">Mingguan (Sen–Min)</option></select></label></div>
        <div className="chart-area">{!trend.some((point) => point.fuel !== null || point.hours !== null) ? <p className="empty-chart">Tidak ada pengukuran pada filter ini.</p> : <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 12, right: 16, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 4" />
            <XAxis dataKey="date" {...axis} tickFormatter={(date: string) => formatDate(date, { day: "numeric", month: "short" })} tickMargin={10} minTickGap={20} />
            <YAxis yAxisId="fuel" {...axis} width={46} tickFormatter={formatNumber} label={{ value: "L", position: "insideTopLeft" }} />
            <YAxis yAxisId="hours" orientation="right" {...axis} width={46} tickFormatter={formatNumber} label={{ value: "jam", position: "insideTopRight" }} />
            <Tooltip content={({ active, payload }) => { const point = payload?.[0]?.payload as typeof trend[number] | undefined; return active && point ? <div className="trend-tooltip"><strong>{formatDate(point.date)}{point.endDate !== point.date ? ` – ${formatDate(point.endDate)}` : ""}</strong><br />Petak: {point.plots || "tidak ada aktivitas"}<br />Solar: {formatNumber(point.fuel)} L<br />HM: {formatNumber(point.hours)} jam</div> : null; }} />
            <Line yAxisId="fuel" type="linear" dataKey="fuel" name="Solar" stroke={orange} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
            <Line yAxisId="hours" type="linear" dataKey="hours" name="HM" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
          </LineChart>
        </ResponsiveContainer>}</div>
        <ul className="trend-legend" aria-label="Legenda grafik tren">
          <li><span className="trend-legend-swatch trend-legend-fuel" aria-hidden="true" />Solar riil · L (sumbu kiri)</li>
          <li><span className="trend-legend-swatch trend-legend-hours" aria-hidden="true" />Jam kerja · jam (sumbu kanan)</li>
        </ul>
      </Card>
      <FuelVariance withdrawals={withdrawals} refill={summary.totals.refill} />
      <ChartPanel title={chartTitles[3]} description="Solar riil ÷ HM berpasangan · L/jam" empty={!plots.some((plot) => plot.efficiency !== null)}>
        <HorizontalChart plots={plots} dataKey="efficiency" unit="L/jam" reducedMotion={reducedMotion} />
      </ChartPanel>
      <ChartPanel title={chartTitles[4]} description="Total hour meter operasional · jam" empty={!plots.some((plot) => plot.hours !== null)}>
        <HorizontalChart plots={plots} dataKey="hours" unit="jam" reducedMotion={reducedMotion} />
      </ChartPanel>
      <Card className="panel chart-panel fuel-comparison-chart" aria-label={chartTitles[5]}>
        <CardHeader className="panel-heading"><div className="chart-heading"><Fuel aria-hidden="true" /><div><CardTitle>{chartTitles[5]}</CardTitle><CardDescription>Pengisian sesuai filter · total konsumsi sumber per petak</CardDescription></div></div></CardHeader>
        <CardContent className="chart-area">
          {!fuelComparison.some((plot) => plot.refill !== null || plot.consumption !== null) ? <p className="empty-chart">Tidak ada pengukuran pada filter ini.</p> : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fuelComparison} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 4" />
              <XAxis dataKey="code" {...axis} tickMargin={10} />
              <YAxis {...axis} width={46} tickFormatter={formatNumber} />
              <Tooltip cursor={{ fill: "#FFF7ED" }} content={({ active, label }) => { const plot = fuelComparison.find((item) => item.code === String(label)); return active && plot ? <div className="trend-tooltip"><strong>{plot.code}</strong><br />Pengisian periode: {formatNumber(plot.refill)} L<br />Total konsumsi sumber: {formatNumber(plot.consumption)} L</div> : null; }} />
              <Bar dataKey="refill" name="Total pengisian" fill="#2563EB" maxBarSize={30} radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
              <Bar dataKey="consumption" name="Total konsumsi" fill={orange} maxBarSize={30} radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>}
        </CardContent>
        <ul className="trend-legend" aria-label="Legenda perbandingan solar">
          <li><span className="trend-legend-swatch trend-legend-hours" aria-hidden="true" />Total pengisian · L</li>
          <li><span className="trend-legend-swatch trend-legend-fuel" aria-hidden="true" />Total konsumsi · L</li>
        </ul>
        <details className="fuel-comparison-details"><summary>Lihat nilai per petak</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Nilai perbandingan solar per petak"><table><thead><tr><th scope="col">Kode petak</th><th scope="col">Total pengisian (L)</th><th scope="col">Total konsumsi (L)</th></tr></thead><tbody>{fuelComparison.map((plot) => <tr key={plot.code}><th scope="row">{plot.code}</th><td>{formatNumber(plot.refill)}</td><td>{formatNumber(plot.consumption)}</td></tr>)}</tbody></table></div></details>
        <p className="fuel-comparison-note">Pengisian mengikuti filter aktivitas. Total konsumsi adalah metadata seluruh sumber per petak, bukan konsumsi periode dan tidak mengikuti filter tanggal atau SPK. N/A berarti nilai belum tersedia atau perlu tinjauan; selisih bukan sisa stok.</p>
      </Card>
      {summaryPanel}
    </div>
  );
}

function FuelVariance({ withdrawals, refill }: { withdrawals: { value: number | null; note: string }; refill: number | null }) {
  const taken = withdrawals.value;
  const max = Math.max(taken ?? 0, refill ?? 0);
  const difference = fuelWithdrawalDifference(taken, refill);
  return <Card className="panel chart-panel fuel-variance" aria-label="Perbandingan pengambilan dan pengisian solar">
    <CardHeader className="panel-heading"><div className="chart-heading"><Fuel aria-hidden="true" /><div><CardTitle>Pengambilan dan Pengisian Solar</CardTitle><CardDescription>Perbandingan sesuai filter periode</CardDescription></div></div></CardHeader>
    <CardContent className="fuel-variance-content">
      {[{ label: "Pengambilan", value: taken }, { label: "Pengisian", value: refill }].map(({ label, value }) => <div className="fuel-variance-row" key={label}>
        <div className="fuel-variance-label"><span>{label}</span><strong>{value === null ? "Belum tersedia" : `${formatNumber(value)} L`}</strong></div>
        <div className="fuel-variance-track" aria-hidden="true"><span style={{ width: `${max > 0 && typeof value === "number" ? (value / max) * 100 : 0}%` }} /></div>
      </div>)}
      <div className="fuel-variance-total"><span>Selisih pencatatan</span><strong>{difference === null ? "Belum tersedia" : `${difference > 0 ? "+" : ""}${formatNumber(difference)} L`}</strong></div>
      <p className="fuel-variance-note">Pengambilan dikurangi pengisian; selisih bukan sisa stok.</p>
      {withdrawals.note !== "Pengambilan dalam periode" && <p className="fuel-variance-note" role="status">{withdrawals.note}</p>}
    </CardContent>
  </Card>;
}

function HorizontalChart({ plots, dataKey, unit, reducedMotion }: {
  plots: DashboardSummary["plots"];
  dataKey: "efficiency" | "hours";
  unit: string;
  reducedMotion: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={plots} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="3 4" />
        <XAxis type="number" {...axis} tickFormatter={formatNumber} />
        <YAxis type="category" dataKey="code" {...axis} width={70} interval={0} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#FFF7ED" }} formatter={(value) => [`${formatNumber(typeof value === "number" ? value : null)} ${unit}`, dataKey === "hours" ? "HM kerja" : "Konsumsi"]} />
        <Bar dataKey={dataKey} fill={dataKey === "hours" ? "#2563EB" : orange} barSize={10} radius={[0, 3, 3, 0]} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out">
          <LabelList dataKey={dataKey} position="right" offset={7} fill="#334155" fontSize={12} formatter={(value: unknown) => typeof value === "number" && Number.isFinite(value) ? formatNumber(value) : ""} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
