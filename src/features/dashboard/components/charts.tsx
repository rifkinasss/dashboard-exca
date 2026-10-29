"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, ChartNoAxesCombined, PieChart as PieIcon, Settings, Hourglass } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DashboardSummary, ValidatedOverviewRecord } from "../types";
import { monitoringTrend } from "../lib/interactive-monitoring";
import { formatDate, formatNumber } from "../lib/format";

const orange = "#EA580C";
const statusColors: Record<string, string> = {
  "Dalam pengerjaan": "#ffa94f",
  "Mulai pengerjaan": "#f97316",
  Selesai: "#75aa58",
  Ditunda: "#F59E0B",
  "Belum mulai": "#94A3B8",
  "Belum diketahui": "#475569",
  "Perlu tinjau": "#475569",
};
const axis = { tickLine: false, axisLine: false, tick: { fill: "#64748B", fontSize: 11 } };
const tooltipStyle = { border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, color: "#334155" };
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
  "Efisiensi Solar per Petak", "Jam Kerja per Petak",
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

export function Charts({ summary, rows, summaryPanel }: { summary: DashboardSummary; rows: ValidatedOverviewRecord[]; summaryPanel: ReactNode }) {
  const [interval, setInterval] = useState<"daily" | "weekly">("daily");
  const trend = useMemo(() => monitoringTrend(rows, interval), [rows, interval]);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, getServerReducedMotion);
  if (!mounted) {
    return (
      <div className="chart-grid" role="status" aria-label="Menyiapkan grafik">
        {chartTitles.map((title, index) => (
          <section className={`panel chart-panel ${index < 2 ? "chart-wide" : ""}`} key={title}>
            <h2>{title}</h2><div className="chart-area chart-loading">Menyiapkan grafik…</div>
          </section>
        ))}
        {summaryPanel}
      </div>
    );
  }
  const plots = summary.plots;
  return (
    <div className="chart-grid">
      <ChartPanel title={chartTitles[0]} description="Pemakaian riil · liter" empty={!plots.some((plot) => plot.fuel !== null)} className="chart-wide">
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
      <Card className="panel chart-panel chart-wide" aria-label={chartTitles[1]}>
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
      <section className="panel status-panel" aria-label={chartTitles[2]}>
        <div className="panel-heading"><div className="chart-heading"><PieIcon aria-hidden="true" /><div><h2>{chartTitles[2]}</h2><p>Status terakhir aktivitas dalam periode</p></div></div></div>
        <div className="status-chart">
          {plots.length ? <>
            <div className="donut-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie data={summary.statuses} dataKey="count" nameKey="status" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none" isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out">
                    {summary.statuses.map((item) => <Cell key={item.status} fill={statusColors[item.status]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} petak`, "Jumlah"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-total"><strong>{plots.length}</strong><span>petak</span></div>
            </div>
            <ul className="status-legend">
              {summary.statuses.map((item) => (
                <li key={item.status}>
                  <span className="legend-dot" style={{ background: statusColors[item.status] }} />
                  <span>{item.status}</span><strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </> : <p className="empty-chart">Tidak ada petak pada filter ini.</p>}
        </div>
      </section>
      <ChartPanel title={chartTitles[3]} description="Solar riil ÷ HM berpasangan · L/jam" empty={!plots.some((plot) => plot.efficiency !== null)}>
        <HorizontalChart plots={plots} dataKey="efficiency" unit="L/jam" reducedMotion={reducedMotion} />
      </ChartPanel>
      <ChartPanel title={chartTitles[4]} description="Total hour meter operasional · jam" empty={!plots.some((plot) => plot.hours !== null)}>
        <HorizontalChart plots={plots} dataKey="hours" unit="jam" reducedMotion={reducedMotion} />
      </ChartPanel>
      {summaryPanel}
    </div>
  );
}

function HorizontalChart({ plots, dataKey, unit, reducedMotion }: {
  plots: DashboardSummary["plots"];
  dataKey: "efficiency" | "hours";
  unit: string;
  reducedMotion: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={plots} layout="vertical" margin={{ top: 0, right: 18, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="3 4" />
        <XAxis type="number" {...axis} tickFormatter={formatNumber} />
        <YAxis type="category" dataKey="code" {...axis} width={56} interval={0} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#FFF7ED" }} formatter={(value) => [`${formatNumber(typeof value === "number" ? value : null)} ${unit}`, dataKey === "hours" ? "HM kerja" : "Konsumsi"]} />
        <Bar dataKey={dataKey} fill={orange} barSize={10} radius={[0, 3, 3, 0]} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}
