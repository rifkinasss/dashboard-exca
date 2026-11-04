"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/features/dashboard/data/source-types";
import { defaultFilters } from "@/features/dashboard/lib/overview";
import { readFilters } from "@/features/dashboard/lib/interactive-monitoring";
import { formatNumber } from "@/features/dashboard/lib/format";
import { calculateTwoPercentTax } from "@/features/shared/tax";
import { buildFinanceView } from "../lib/build-finance-view";
import { groupMonthlyEstimates } from "../lib/daily-estimate";
import { BarChart3, ChevronDown, CircleDollarSign, Fuel, Info, Map as MapIcon, PieChart, RotateCcw, SlidersHorizontal, TrendingUp, Wallet, Banknote, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import "./finance-layout.css";

const charts = [
  { title: "Pendapatan vs Pengeluaran Solar per Petak", icon: BarChart3, description: "Perbandingan nilai kotor dan biaya solar sumber" },
  { title: "Proporsi Biaya Solar terhadap Pendapatan", icon: PieChart, description: "Bagian biaya solar dari nilai kotor" },
  { title: "Margin Setelah Biaya Solar per Petak", icon: TrendingUp, description: "Nilai kotor setelah biaya solar terverifikasi" },
  { title: "Estimasi Pendapatan dan Biaya Harian", icon: Hourglass, description: "Alokasi snapshot berdasarkan proporsi HM, bukan transaksi aktual" },
];

const rupiah = (value: number | null) => value === null ? "N/A" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(value);

function FinanceEstimateChart({ estimate, totalRecords, interval }: { estimate: NonNullable<ReturnType<typeof buildFinanceView>>["dailyEstimate"]; totalRecords: number; interval: "harian" | "bulanan" }) {
  return <div className="finance-chart" role="img" aria-label="Estimasi alokasi pendapatan dan biaya berdasarkan HM, bukan transaksi aktual"><ResponsiveContainer width="100%" height="80%"><LineChart data={interval === "bulanan" ? groupMonthlyEstimates(estimate.rows) : estimate.rows} margin={{ top: 12, right: 20, left: 8, bottom: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tickFormatter={(value: string) => interval === "bulanan" ? value : value.slice(5)} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `${value / 1000000} jt`} tick={{ fontSize: 12 }} width={65} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => rupiah(typeof value === "number" ? value : null)} /><Line type="monotone" dataKey="gross" name="Estimasi pendapatan" stroke="var(--primary)" connectNulls={false} dot /><Line type="monotone" dataKey="cost" name="Estimasi biaya solar" stroke="var(--muted-foreground)" connectNulls={false} dot /></LineChart></ResponsiveContainer><div className="finance-chart-legend"><span><i className="finance-legend-gross" />Pendapatan: {estimate.grossPairs}/{totalRecords} baris sumber</span><span><i className="finance-legend-cost" />Biaya: {estimate.costPairs}/{totalRecords} baris sumber{estimate.costPairs < totalRecords ? " · parsial" : ""}</span><span>Alokasi berdasarkan HM; bukan transaksi aktual.{interval === "bulanan" && " Bulan mengikuti rentang tanggal yang dipilih."}</span></div></div>;
}

function FinanceProportionChart({ gross, cost, coverage }: { gross: number; cost: number; coverage: string }) {
  const remainingPercent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(((gross - cost) / gross) * 100);
  return <div className="finance-chart" role="img" aria-label={`Sisa setelah biaya solar ${remainingPercent} persen dari pendapatan berpasangan. ${coverage}.`}>
    <div className="finance-donut-plot"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={[{ name: "Biaya solar", value: cost }, { name: "Sisa setelah biaya solar", value: gross - cost }]} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%">{["var(--primary)", "#bd895d"].map((color) => <Cell key={color} fill={color} />)}</Pie><Tooltip position={{ y: 0 }} wrapperStyle={{ zIndex: 2, maxWidth: "100%" }} contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 12, whiteSpace: "normal" }} itemStyle={{ color: "var(--heading)" }} formatter={(value) => rupiah(typeof value === "number" ? value : null)} /></RechartsPieChart></ResponsiveContainer><div className="finance-donut-center" aria-hidden="true"><strong>{remainingPercent}%</strong><span>Sisa setelah<br />biaya solar</span></div></div>
    <div className="finance-chart-legend"><span><i className="finance-legend-gross" />Biaya solar</span><span><i className="finance-legend-remaining" />Sisa setelah biaya solar</span><span>{coverage} · pasangan pendapatan dan biaya</span></div>
  </div>;
}

function FinanceMultiSelect({ label, options, selected: values, onChange }: { label: string; options: { value: string; search: string }[]; selected: string[]; onChange: (values: string[]) => void }) {
  const [query, setQuery] = useState("");
  const matching = options.filter((option) => `${option.value} ${option.search}`.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")));
  return <div className="finance-select"><span>{label}</span><details className="plot-dropdown"><summary>{values.length ? `${values.length} dipilih` : `Semua ${label}`} <ChevronDown size={15} aria-hidden="true" /></summary><div className="spk-search"><Input type="search" aria-label={`Cari ${label}`} placeholder={`Cari ${label}`} value={query} onChange={(event) => setQuery(event.target.value)} /><Button type="button" variant="outline" onClick={() => onChange([])}>Hapus pilihan</Button><div className="plot-options">{matching.length ? matching.map((option) => <label className="check-option" key={option.value}><Checkbox checked={values.includes(option.value)} onCheckedChange={(checked) => onChange(checked ? [...values, option.value] : values.filter((value) => value !== option.value))} /><span>{option.value}{option.search && <small className="spk-plots">{option.search}</small>}</span></label>) : <p role="status">Tidak ada hasil.</p>}</div></div></details></div>;
}

function FinanceSourceNotice({ finance, operational, hasView }: { finance: DashboardData | null; operational: DashboardData; hasView: boolean }) {
  const error = finance?.status.error ?? operational.status.error;
  if (error) return <Alert className="finance-notice"><Info aria-hidden="true" /><AlertTitle>Pembaruan data gagal</AlertTitle><AlertDescription>{error.message} {error.nextAction} Sistem akan mencoba lagi secara otomatis.</AlertDescription></Alert>;
  if (!hasView) return <Alert className="finance-notice"><Info aria-hidden="true" /><AlertTitle>Data keuangan belum tersedia</AlertTitle><AlertDescription>Periksa kembali sumber data. Sistem akan mencoba lagi secara otomatis.</AlertDescription></Alert>;
  return null;
}

export function FinanceDashboard({ finance, operational }: { finance: DashboardData | null; operational: DashboardData }) {
  const search = useSearchParams();
  const query = search.toString();
  const filters = readFilters(query, { ...defaultFilters, startDate: "", endDate: "" });
  const view = finance?.kind === "ready" && operational.kind === "ready" ? buildFinanceView(finance.rows, operational.rows, filters, { financeSpkMerges: finance.spkMerges, financePlotMerges: finance.plotCodeMerges, operationSpkMerges: operational.spkMerges, operationPlotMerges: operational.plotCodeMerges, operationWorksheet: operational.status.worksheet ?? "Overview Operasional" }) : null;
  const [tableSearch, setTableSearch] = useState("");
  const [estimateInterval, setEstimateInterval] = useState<"harian" | "bulanan">("harian");
  const [sort, setSort] = useState<{ key: "spk" | "plot" | "area" | "fuelRefill" | "fuelCost" | "gross" | "margin"; ascending: boolean }>({ key: "plot", ascending: true });
  const spks = new Map<string, Set<string>>();
  for (const option of view?.operational.spkOptions ?? []) spks.set(option.number, new Set(option.plots));
  for (const record of view?.financeRecords ?? []) if (record.spk) { const plots = spks.get(record.spk) ?? new Set<string>(); if (record.plot) plots.add(record.plot); spks.set(record.spk, plots); }
  const spkOptions = [...spks].map(([value, plots]) => ({ value, search: [...plots].join(", ") })).sort((a, b) => a.value.localeCompare(b.value));
  const plotOptions = [...new Set([...(view?.operational.plotCodes ?? []), ...(view?.financeRecords.map((record) => record.plot).filter((value): value is string => value !== null) ?? [])])].sort().map((value) => ({ value, search: "" }));
  const tableRows = (view?.rows ?? []).filter((row) => `${row.spk ?? ""} ${row.plot ?? ""}`.toLowerCase().includes(tableSearch.toLowerCase())).slice().sort((a, b) => { const x = a[sort.key], y = b[sort.key]; if (x === null) return y === null ? 0 : 1; if (y === null) return -1; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "id")) * (sort.ascending ? 1 : -1); });
  const sortBy = (key: typeof sort.key) => setSort((current) => ({ key, ascending: current.key === key ? !current.ascending : true }));
  const coverageNote = (metric: NonNullable<typeof view>["costCoverage"]) => view?.hasPeriod ? "Tidak bertanggal di sumber keuangan" : `${metric.eligibleCount} dari ${metric.totalCount} baris sumber · ${metric.value === null ? "Belum tersedia" : metric.complete ? "Lengkap" : "Parsial"}`;
  const metrics = [
    { icon: MapIcon, name: "Total Luas Petak", value: view ? `${formatNumber(view.operational.summary.totals.area)} Ha` : "N/A", note: "Luas petak aktivitas terpilih" },
    { icon: Fuel, name: "Total Solar", value: view ? `${formatNumber(view.operational.summary.totals.refill)} L` : "N/A", note: "Pengisian operasional dalam periode" },
    { icon: Banknote, name: "Pendapatan Setelah Pajak 2%", value: rupiah(calculateTwoPercentTax(view?.grossCoverage.value ?? null)?.afterTax ?? null), beforeTax: view?.grossCoverage.value ?? undefined, note: view ? coverageNote(view.grossCoverage) : "Sumber belum tersedia" },
    { icon: Wallet, name: "Biaya Solar Terverifikasi", value: rupiah(view?.costCoverage.value ?? null), note: view ? coverageNote(view.costCoverage) : "Sumber belum tersedia" },
    { icon: TrendingUp, name: "Margin Setelah Biaya Solar", value: rupiah(view?.marginCoverage.value ?? null), note: view ? coverageNote(view.marginCoverage) : "Sumber belum tersedia" },
  ];
  function updateFilter(key: "start" | "end" | "spk" | "plot", values: string[]) {
    const params = new URLSearchParams(window.location.search);
    params.delete(key);
    for (const value of values) if (value) params.append(key, value);
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }
  function resetFilters() {
    const params = new URLSearchParams(query);
    for (const key of ["start", "end", "spk", "plot"]) params.delete(key);
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }
  return <main className="finance-main finance-dashboard-v2">
    <header className="dashboard-page-heading"><span className="dashboard-heading-icon"><CircleDollarSign aria-hidden="true" /></span><div><h1>Dashboard Keuangan</h1><p>Nilai petak, biaya solar, dan margin operasional.</p></div></header>
    <div className="finance-layout"><section className="finance-filters finance-filter-panel" aria-label="Filter keuangan"><div className="finance-filter-heading"><SlidersHorizontal size={18} aria-hidden="true" /><h2>Filter keuangan</h2></div>
      <div className="finance-filter-form">
        <FinanceMultiSelect label="No. SPK" options={spkOptions} selected={filters.selectedSpkNumbers} onChange={(values) => updateFilter("spk", values)} />
        <FinanceMultiSelect label="Kode Petak" options={plotOptions} selected={filters.plotCodes} onChange={(values) => updateFilter("plot", values)} />
        <label>Tanggal mulai<Input name="start" type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => { if (event.currentTarget.checkValidity()) updateFilter("start", [event.target.value]); else event.currentTarget.reportValidity(); }} /></label>
        <label>Tanggal akhir<Input name="end" type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(event) => { if (event.currentTarget.checkValidity()) updateFilter("end", [event.target.value]); else event.currentTarget.reportValidity(); }} /></label>
        <div className="finance-filter-actions"><Button type="button" variant="outline" onClick={resetFilters}><RotateCcw size={15} aria-hidden="true" /> Reset</Button></div>
      </div>
    </section>
    <div className="finance-content"><FinanceSourceNotice finance={finance} operational={operational} hasView={view !== null} /><section aria-labelledby="finance-kpis"><div className="finance-section-heading"><div><h2 id="finance-kpis">Ikhtisar keuangan</h2><p>Aktivitas mengikuti tanggal; nilai keuangan merupakan snapshot seluruh waktu.</p></div></div><div className="finance-kpi-grid">{metrics.map((metric) => <Card className="finance-kpi" key={metric.name}><span className="finance-kpi-icon"><metric.icon size={22} strokeWidth={1.8} aria-hidden="true" /></span><div className="finance-kpi-copy"><CardHeader><CardTitle>{metric.name}</CardTitle></CardHeader><CardContent>{metric.value.startsWith("N/A") ? <span className="finance-metric-unavailable">Belum tersedia</span> : <span className="finance-metric">{metric.value}</span>}<CardDescription>{metric.note}</CardDescription>{metric.beforeTax !== undefined && <div className="finance-after-tax"><span>Sebelum pajak</span><strong>{rupiah(metric.beforeTax)}</strong></div>}</CardContent></div></Card>)}</div></section>
    <section aria-labelledby="finance-analysis"><div className="finance-section-heading"><div><h2 id="finance-analysis">Analisis keuangan</h2><p>Grafik snapshot untuk semua tanggal; estimasi mengikuti periode terpilih.</p></div></div><div className="finance-chart-grid">{charts.map((chart, index) => <Card className="finance-panel" key={chart.title}><CardHeader><span className="finance-panel-icon"><chart.icon size={20} aria-hidden="true" /></span><div><CardTitle>{index === 3 ? `Estimasi Pendapatan dan Biaya ${estimateInterval === "bulanan" ? "Bulanan" : "Harian"}` : chart.title}</CardTitle><CardDescription>{chart.description}</CardDescription></div>{index === 3 && <label className="finance-interval">Interval <select value={estimateInterval} onChange={(event) => setEstimateInterval(event.target.value as "harian" | "bulanan")}><option value="harian">Harian</option><option value="bulanan">Bulanan</option></select></label>}</CardHeader><CardContent>{view && !view.hasPeriod && view.rows.some((row) => row.matched) && (index === 0 || index === 2) ? <div className="finance-chart" role="img" aria-label={`${chart.title} dari snapshot sumber tanpa tanggal`}><ResponsiveContainer width="100%" height="100%"><BarChart data={view.rows.filter((row) => row.matched)} layout={index === 2 ? "vertical" : "horizontal"} margin={{ top: 12, right: 20, left: 8, bottom: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={index === 2} horizontal={index !== 2} />{index === 2 ? <><XAxis type="number" tickFormatter={(value) => `${value / 1000000} jt`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="plot" tick={{ fontSize: 12 }} width={90} axisLine={false} tickLine={false} /></> : <><XAxis dataKey="plot" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `${value / 1000000} jt`} tick={{ fontSize: 12 }} width={65} axisLine={false} tickLine={false} /></>}<Tooltip formatter={(value) => rupiah(typeof value === "number" ? value : null)} /><Bar dataKey={index === 0 ? "gross" : "margin"} name={index === 0 ? "Nilai kotor sumber" : "Margin setelah biaya solar"} fill="var(--primary)" />{index === 0 && <Bar dataKey="fuelCost" name="Biaya solar terverifikasi" fill="#64748B" />}</BarChart></ResponsiveContainer><div className="finance-chart-legend"><span><i className="finance-legend-gross" />{index === 0 ? "Nilai kotor sumber" : "Margin setelah biaya solar"}</span>{index === 0 && <span><i className="finance-legend-cost" />Biaya solar terverifikasi</span>}</div></div> : view && !view.hasPeriod && index === 1 && view.pairedRevenue.value !== null && view.pairedCost.value !== null && view.pairedRevenue.value > 0 && view.pairedCost.value <= view.pairedRevenue.value ? <FinanceProportionChart gross={view.pairedRevenue.value} cost={view.pairedCost.value} coverage={coverageNote(view.pairedRevenue)} /> : view && index === 3 && view.dailyEstimate.rows.length > 0 ? <FinanceEstimateChart estimate={view.dailyEstimate} totalRecords={view.rows.length} interval={estimateInterval} /> : <div className="finance-empty"><span className="finance-empty-icon"><CircleDollarSign aria-hidden="true" /></span><strong>Belum ada data untuk ditampilkan</strong><p>{index === 3 ? "Estimasi tidak tersedia: tidak ada pasangan dengan tanggal dan HM yang lengkap pada periode ini." : index === 1 ? "Proporsi memerlukan pendapatan dan biaya berpasangan, dengan pendapatan positif dan biaya tidak melebihi pendapatan." : view?.hasPeriod ? "Nilai keuangan sumber tidak memiliki tanggal periode." : "Belum ada pasangan sumber yang dapat ditampilkan."}</p></div>}</CardContent></Card>)}</div></section>
    <section aria-labelledby="finance-summary"><div className="finance-section-heading"><div><h2 id="finance-summary">Snapshot keuangan per SPK dan petak</h2><p>Nilai sumber seluruh waktu; filter tanggal tidak diterapkan pada snapshot ini. Filter SPK dan petak tetap berlaku.</p></div><Input type="search" aria-label="Cari tabel SPK atau petak" placeholder="Cari SPK atau petak" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} /></div><Card className="finance-summary"><CardContent><div className="finance-table-scroll" role="region" tabIndex={0} aria-label="Tabel snapshot keuangan"><table><thead><tr>{([{ key: "spk", label: "No. SPK" }, { key: "plot", label: "Kode Petak" }, { key: "area", label: "Luas (Ha)" }, { key: "fuelRefill", label: "Solar masuk (L)" }, { key: "fuelCost", label: "Biaya Solar" }, { key: "gross", label: "Pendapatan Kotor" }, { key: "margin", label: "Margin Setelah Biaya Solar" }] as const).map(({ key, label }) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => sortBy(key)}>{label} {sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</button></th>)}<th scope="col">Kelengkapan</th></tr></thead><tbody>{tableRows.length ? tableRows.map((row) => <tr key={row.financeRow}><td>{row.spk ?? "Belum tersedia"}{row.sourceSpk === null && row.matched ? " (cocok dari petak)" : ""}</td><td>{row.plot ?? "Belum tersedia"}</td><td>{formatNumber(row.area)}</td><td>{formatNumber(row.fuelRefill)}</td><td>{rupiah(row.fuelCost)}</td><td>{rupiah(row.gross)}</td><td>{rupiah(row.margin)}</td><td>{!row.matched ? "Hubungan belum pasti; dikecualikan" : row.gross === null || row.fuelCost === null ? "Parsial" : "Lengkap"}</td></tr>) : <tr><td colSpan={8} className="finance-table-empty"><strong>Data tidak ditemukan</strong><p>Periksa sumber, pencarian, dan filter.</p></td></tr>}</tbody></table></div></CardContent></Card></section>
    {view && <details className="finance-quality"><summary>Kualitas dan hubungan data · {view.issues.length} temuan</summary><p>{view.matchedCount} pasangan SPK/petak cocok dari {view.operationPairCount} pasangan operasional. Baris total spreadsheet {view.summaryRows.join(", ") || "tidak ada"} tidak dijumlahkan lagi.</p>{view.issues.length > 0 && <ul>{view.issues.map((issue, index) => <li key={`${issue.worksheet}-${issue.row}-${issue.code}-${index}`}>{issue.worksheet}!{issue.row}: {issue.message}{issue.relatedRows?.length ? ` Baris terkait: ${issue.relatedRows.join(", ")}.` : ""}</li>)}</ul>}</details>}
    </div></div>
  </main>;
}
