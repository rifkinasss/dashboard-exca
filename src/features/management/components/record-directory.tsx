"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowDown, ArrowUp, CalendarDays, Map, Plus, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityDataTable } from "./activity-data-table";
import { ActivityFormDialog } from "@/features/activities/components/activity-form-dialog";
import { FuelFormDialog } from "@/features/fuel/components/fuel-form-dialog";
import { FinanceRecordFormDialog } from "@/features/finance/components/finance-record-form-dialog";
import { formatNumber } from "@/features/dashboard/lib/format";
import type { resolveWithdrawalPricing } from "@/features/dashboard/lib/fuel-price";

export type ManagedRecordKind = "activity" | "fuel" | "finance";
export interface ManagedRecord { key: string; primary: string; plot: string; plotId?: string; spk: string; date: string; value: string; status: string; search: string; details: [string, string][]; issues: string[]; sortValue: number | string | null; purchases?: { invalidRows: number; records: { liters: number; pricing: ReturnType<typeof resolveWithdrawalPricing> }[] } | null }
type SortKey = "primary" | "plot" | "date" | "value";
const titles = { activity: "Aktivitas Operasional", fuel: "Pengisian Solar", finance: "Data Keuangan" };
const subtitles = {
  activity: "Riwayat pekerjaan, HM, status, dan pengukuran dari sumber operasional.",
  fuel: "Baris sumber yang mencatat pengisian. Tanggal aktivitas sumber belum tentu tanggal transaksi pengisian.",
  finance: "Snapshot dan nilai keuangan sumber; tanggal transaksi tidak tersedia pada kontrak saat ini.",
};

export function RecordDirectory({ kind, rows, plotCodes, spkNumbers, qualityCount }: { kind: ManagedRecordKind; rows: ManagedRecord[]; plotCodes: string[]; spkNumbers: string[]; qualityCount: number }) {
  const [query, setQuery] = useState("");
  const [plot, setPlot] = useState("");
  const [spk, setSpk] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "date", direction: -1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ManagedRecord | null>(null);
  const [editing, setEditing] = useState<ManagedRecord | null | undefined>(undefined);
  const visible = useMemo(() => rows.filter((row) => {
    if (query && !row.search.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID"))) return false;
    if (plot && row.plot !== plot) return false;
    if (kind === "finance" && spk && row.spk !== spk) return false;
    if (kind === "activity" && status !== "all" && (status === "review" ? row.issues.length === 0 : row.status !== status)) return false;
    if (kind !== "finance" && (from || to) && (!row.date || (from && row.date < from) || (to && row.date > to))) return false;
    if (kind === "finance" && status !== "all" && (status === "review" ? row.issues.length === 0 : row.issues.length > 0)) return false;
    if (kind === "fuel" && status !== "all" && (status === "review" ? row.issues.length === 0 : row.issues.length > 0)) return false;
    return true;
  }).sort((a, b) => {
    const left = sort.key === "primary" ? a.primary : sort.key === "plot" ? a.plot : sort.key === "date" ? a.date : a.sortValue ?? a.value;
    const right = sort.key === "primary" ? b.primary : sort.key === "plot" ? b.plot : sort.key === "date" ? b.date : b.sortValue ?? b.value;
    return (typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""), "id-ID", { numeric: true })) * sort.direction;
  }), [rows, query, plot, spk, status, from, to, sort, kind]);
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const current = Math.min(page, pages);
  const pageRows = visible.slice((current - 1) * 10, current * 10);
  const setFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  function sortBy(key: SortKey, label: string) {
    const active = sort.key === key;
    const Icon = active ? sort.direction === 1 ? ArrowUp : ArrowDown : null;
    return <button type="button" className="directory-sort" aria-label={`${label}, ${active ? sort.direction === 1 ? "urut naik" : "urut turun" : "urut"}`} onClick={() => setSort((currentSort) => currentSort.key === key ? { key, direction: currentSort.direction === 1 ? -1 : 1 } : { key, direction: 1 })}>{label}{Icon && <Icon size={13} aria-hidden="true" />}</button>;
  }
  const startEdit = (row?: ManagedRecord) => { setSelected(null); setEditing(row ?? null); };
  const availableStatuses = kind === "activity" ? [...new Set(rows.map((row) => row.status).filter(Boolean))] : [];

  if (kind === "activity") {
    const lastDate = visible.map((row) => row.date).filter(Boolean).sort().at(-1);
    const dateLabel = (date: string) => date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "—";
    const reset = () => { setQuery(""); setPlot(""); setFrom(""); setTo(""); setStatus("all"); setPage(1); };
    return <main className="directory-page activity-page">
      <header className="activity-heading"><div><span className="directory-eyebrow">MANAJEMEN DATA</span><h1>Aktivitas Operasional</h1><p>Pantau riwayat pekerjaan dan pengisian solar di setiap petak.</p></div><Button onClick={() => startEdit()}><Plus data-icon="inline-start" aria-hidden="true" />Tambah aktivitas</Button></header>
      <section className="activity-summary" aria-label="Ringkasan hasil filter">
        <div><span className="activity-summary-icon"><Activity aria-hidden="true" /></span><span><small>Aktivitas ditampilkan</small><strong>{visible.length}</strong><em>Catatan sesuai filter</em></span></div>
        <div><span className="activity-summary-icon"><Map aria-hidden="true" /></span><span><small>Petak tercatat</small><strong>{new Set(visible.map((row) => row.plot).filter(Boolean)).size}</strong><em>Petak dalam hasil filter</em></span></div>
        <div><span className="activity-summary-icon"><CalendarDays aria-hidden="true" /></span><span><small>Aktivitas terbaru</small><strong>{lastDate ? dateLabel(lastDate) : "—"}</strong><em>Tanggal pada hasil filter</em></span></div>
      </section>
      <section className="activity-list"><div className="activity-list-heading"><div><h2>Riwayat aktivitas</h2><p>Cari dan saring catatan pekerjaan berdasarkan petak, tanggal, atau status.</p></div><span>{visible.length} catatan</span></div>
        <div className="activity-filters" aria-label="Cari dan filter aktivitas">
          <label className="activity-search">Pencarian<div><Search aria-hidden="true" /><Input value={query} onChange={(event) => setFilter(setQuery)(event.target.value)} placeholder="Cari petak atau keterangan" /></div></label>
          <label>Kode petak<select value={plot} onChange={(event) => setFilter(setPlot)(event.target.value)}><option value="">Semua petak</option>{plotCodes.map((code) => <option key={code}>{code}</option>)}</select></label>
          <label>Tanggal mulai<Input type="date" value={from} onChange={(event) => setFilter(setFrom)(event.target.value)} /></label>
          <label>Tanggal akhir<Input type="date" value={to} onChange={(event) => setFilter(setTo)(event.target.value)} /></label>
          <label>Status pekerjaan<select value={status} onChange={(event) => setFilter(setStatus)(event.target.value)}><option value="all">Semua status</option>{availableStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <Button variant="outline" onClick={reset} aria-label="Reset filter"><RotateCcw data-icon="inline-start" aria-hidden="true" />Reset</Button>
        </div>
        <ActivityDataTable rows={visible} page={current} onPageChange={setPage} onDetail={setSelected} />
      </section>
      {selected && <ActivityDetail row={selected} close={() => setSelected(null)} />}
      {editing !== undefined && <ActivityFormDialog initial={editing?.details} plotCodes={plotCodes} onClose={() => setEditing(undefined)} />}
    </main>;
  }

  return <main className="directory-page">
    <header className="directory-heading"><div><span className="directory-eyebrow">MANAJEMEN DATA · BACA SAJA</span><h1>{titles[kind]}</h1><p>{subtitles[kind]}</p></div><Button onClick={() => startEdit()} size="sm">Tambah {kind === "fuel" ? "pengisian" : "data keuangan"}</Button></header>
    <section className="directory-toolbar directory-toolbar-wrap" aria-label="Cari dan filter data">
      <label className="directory-search"><Search aria-hidden="true" /><span className="sr-only">Cari data</span><Input value={query} onChange={(event) => setFilter(setQuery)(event.target.value)} placeholder={kind === "finance" ? "Cari SPK atau petak" : "Cari petak, keterangan, atau baris sumber"} /></label>
      <label className="directory-filter">Kode petak<select value={plot} onChange={(event) => setFilter(setPlot)(event.target.value)}><option value="">Semua petak</option>{plotCodes.map((code) => <option key={code}>{code}</option>)}</select></label>
      {kind === "finance" && <label className="directory-filter">Nomor SPK<select value={spk} onChange={(event) => setFilter(setSpk)(event.target.value)}><option value="">Semua SPK</option>{spkNumbers.map((number) => <option key={number}>{number}</option>)}</select></label>}
      {kind !== "finance" && <><label className="directory-filter">{kind === "fuel" ? "Tanggal aktivitas sumber mulai" : "Tanggal mulai"}<Input type="date" value={from} onChange={(event) => setFilter(setFrom)(event.target.value)} /></label><label className="directory-filter">{kind === "fuel" ? "Tanggal aktivitas sumber akhir" : "Tanggal akhir"}<Input type="date" value={to} onChange={(event) => setFilter(setTo)(event.target.value)} /></label></>}
      <label className="directory-filter">Kualitas data<select value={status} onChange={(event) => setFilter(setStatus)(event.target.value)}><option value="all">Semua</option><option value="clean">Tanpa temuan</option><option value="review">Perlu tinjauan</option></select></label>
      <span className="directory-count">{visible.length} dari {rows.length} baris · {qualityCount} temuan sumber</span>
    </section>
    <section className="directory-table-panel" aria-label={`Daftar ${titles[kind]}`}>
      <Table><TableHeader><TableRow><TableHead>{sortBy("primary", kind === "finance" ? "SPK · sumber" : "Sumber")}</TableHead><TableHead>{sortBy("plot", "Kode petak")}</TableHead>{kind !== "finance" && <TableHead>{sortBy("date", kind === "fuel" ? "Tanggal baris sumber" : "Tanggal aktivitas")}</TableHead>}<TableHead>{sortBy("value", kind === "finance" ? "Nilai sumber" : kind === "fuel" ? "Pengisian (L)" : "HM · Solar riil")}</TableHead><TableHead>Kualitas</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{pageRows.map((row) => <TableRow key={row.key}><TableCell className="directory-primary-cell">{row.primary}</TableCell><TableCell>{row.plot || "Belum diketahui"}{row.spk && kind !== "finance" && <span className="directory-secondary-line">SPK {row.spk}</span>}</TableCell>{kind !== "finance" && <TableCell>{row.date || "Tidak tersedia"}</TableCell>}<TableCell>{row.value}</TableCell><TableCell>{row.issues.length ? `${row.issues.length} temuan` : "—"}</TableCell><TableCell><div className="directory-row-actions"><Button size="sm" variant="outline" onClick={() => setSelected(row)}>Detail</Button><Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit draft</Button></div></TableCell></TableRow>)}</TableBody></Table>
      {!pageRows.length && <div className="directory-empty"><strong>{rows.length ? "Tidak ada data yang cocok" : "Belum ada data sumber"}</strong><p>{rows.length ? "Ubah kata pencarian atau filter." : "Tidak ada rekaman sintetis yang ditampilkan sebagai data produksi."}</p></div>}
      <footer className="directory-pagination"><span>Halaman {current} dari {pages} · {visible.length} baris</span><div><Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Berikutnya</Button></div></footer>
    </section>
    {selected && <RecordDetail row={selected} close={() => setSelected(null)} />}
    {editing !== undefined && kind === "fuel" && <FuelFormDialog initial={editing?.details} plotCodes={plotCodes} onClose={() => setEditing(undefined)} />}
    {editing !== undefined && kind === "finance" && <FinanceRecordFormDialog initial={editing?.details} plotCodes={plotCodes} spkNumbers={spkNumbers} onClose={() => setEditing(undefined)} />}
  </main>;
}

function ActivityDetail({ row, close }: { row: ManagedRecord; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  const value = (name: string) => row.details.find(([label]) => label === name)?.[1] || "—";
  const date = row.date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.date}T00:00:00Z`)) : "Tanggal belum tersedia";
  const measurement = (name: string, unit: string) => value(name) === "—" ? "—" : `${value(name)} ${unit}`;
  return <dialog ref={dialog} className="directory-drawer activity-detail" aria-labelledby="activity-detail-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="directory-drawer-panel"><header><div><span className="directory-eyebrow">RINCIAN AKTIVITAS</span><h2 id="activity-detail-title">{row.plot || "Petak belum diketahui"}</h2><p className="activity-detail-date">{date}</p></div><Button variant="outline" onClick={close}>Tutup</Button></header>
      <div className="activity-detail-overview"><span className="activity-status" data-status={row.status === "Selesai" ? "complete" : row.status === "Dalam pengerjaan" ? "progress" : "other"}>{row.status || "Belum diketahui"}</span><span>SPK {row.spk || "belum tersedia"}</span></div>
      <section className="activity-detail-section"><h3>Jam kerja</h3><dl><div><dt>HM awal</dt><dd>{measurement("HM awal", "jam")}</dd></div><div><dt>HM akhir</dt><dd>{measurement("HM akhir", "jam")}</dd></div><div><dt>HM kerja</dt><dd>{measurement("HM kerja", "jam")}</dd></div><div><dt>Estimasi jam kerja</dt><dd>{measurement("Estimasi jam kerja", "jam")}</dd></div></dl></section>
      <section className="activity-detail-section"><h3>Solar</h3><dl><div><dt>Pengisian solar</dt><dd>{measurement("Pengisian solar", "L")}</dd></div></dl></section>
      <section className="activity-detail-section"><h3>Pembelian solar</h3><p className="activity-purchase-note">Transaksi untuk petak dan tanggal yang sama; belum tentu terkait langsung dengan aktivitas ini.</p>{!row.date || !row.plot ? <p>Tanggal atau kode petak belum tersedia untuk mencocokkan pembelian.</p> : !row.purchases ? <p>Data pembelian belum tersedia.</p> : row.purchases.records.length === 0 ? <p>Tidak ada transaksi yang cocok pada tanggal ini.</p> : <div className="activity-purchase-list">{row.purchases.records.map(({ liters, pricing }, index) => <div key={index}><strong>{formatNumber(liters)} L</strong><span>Harga / L: {pricing.price === null ? pricing.kind === "review" ? "Perlu tinjauan" : "Belum tersedia" : `Rp ${formatNumber(pricing.price)}`}</span><span>Biaya: {pricing.cost === null ? pricing.kind === "review" ? "Perlu tinjauan" : "Belum tersedia" : `Rp ${formatNumber(pricing.cost)}`}{pricing.kind === "estimated" && " · Estimasi"}</span></div>)}</div>}{!!row.purchases?.invalidRows && <p className="activity-purchase-note">Sebagian baris pembelian tidak valid dan belum dapat dicocokkan.</p>}</section>
      <section className="activity-detail-section"><h3>Keterangan</h3><p>{value("Keterangan") === "—" ? "Tidak ada keterangan." : value("Keterangan")}</p></section>
      {row.plotId && <div className="activity-detail-footer"><Link href={`/petak/${row.plotId}`}>Lihat detail Petak Lahan <span aria-hidden="true">→</span></Link></div>}
    </section>
  </dialog>;
}

function RecordDetail({ row, close }: { row: ManagedRecord; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="directory-drawer" aria-labelledby="record-detail-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}><section className="directory-drawer-panel"><header><div><span className="directory-eyebrow">JEJAK SUMBER</span><h2 id="record-detail-title">{row.primary}</h2></div><Button variant="outline" onClick={close}>Tutup</Button></header><dl className="directory-detail-grid">{row.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Belum tersedia"}</dd></div>)}</dl><div className="directory-detail-section"><h3>Kualitas data · {row.issues.length} temuan</h3>{row.issues.length ? <ul>{row.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>Tidak ada temuan terkait baris ini.</p>}</div></section></dialog>;
}
