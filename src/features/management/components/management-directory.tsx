"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Clock3, Fuel, Map, MapPinned, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sumMeasured } from "@/features/dashboard/lib/calculate-kpis";
import { formatDate, formatNumber } from "@/features/dashboard/lib/format";
import type { buildManagementDirectory } from "../lib/build-management-directory";
import { PlotFormDialog, type PlotFormInitialValue } from "./plot-form-dialog";
import { SpkFormDialog } from "./spk-form-dialog";
import { PlotDataTable } from "./plot-data-table";

type Directory = ReturnType<typeof buildManagementDirectory>;
type Plot = Directory["plots"][number];
type Spk = Directory["spks"][number];
type SortKey = "name" | "area" | "status" | "activity" | "hours" | "fuel" | "revenue";

function QualityBadge({ count }: { count: number }) {
  return count ? <Badge variant="outline" className="directory-quality">{count} tinjauan</Badge> : <Badge variant="outline" className="directory-clean">Valid</Badge>;
}

function Drawer({ item, close, onEdit, onLinkDocument }: { item: Plot | Spk | null; close: () => void; onEdit: (plot: Plot) => void; onLinkDocument: (number: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (item && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [item]);
  if (!item) return null;
  const plot = "code" in item;
  return <dialog ref={dialog} className="directory-drawer" aria-label={plot ? `Detail petak ${item.code}` : `Detail SPK ${item.number}`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="directory-drawer-panel" aria-labelledby="directory-detail-title">
      <header><div><span className="directory-eyebrow">RINCIAN SUMBER</span><h2 id="directory-detail-title">{plot ? item.code : item.number}</h2></div><Button variant="ghost" size="icon" aria-label="Tutup detail" onClick={close}><X /></Button></header>
      {plot ? <>
        <dl className="directory-detail-grid">
          <div><dt>No. SPK</dt><dd>{item.spks.length ? item.spks.join(", ") : "Belum tersedia"}</dd></div>
          <div><dt>Luas petak</dt><dd>{item.area === null ? "Perlu tinjauan" : `${formatNumber(item.area)} Ha`}</dd></div>
          <div><dt>Status terakhir · seluruh waktu</dt><dd>{item.statusAmbiguous ? "Perlu tinjauan" : item.status ?? "Belum diketahui"}</dd></div>
          <div><dt>Tanggal mulai</dt><dd>{item.startDate ? formatDate(item.startDate) : "Tidak ada tanggal valid"}</dd></div>
          <div><dt>Aktivitas terakhir</dt><dd>{item.lastActivityDate ? formatDate(item.lastActivityDate) : "Tidak ada tanggal valid"}</dd></div>
          <div><dt>HM kerja · seluruh waktu</dt><dd>{item.hours === null ? "Belum tersedia" : `${formatNumber(item.hours)} jam`}</dd></div>
          <div><dt>Solar riil · seluruh waktu</dt><dd>{item.fuel === null ? "Belum tersedia" : `${formatNumber(item.fuel)} L`}</dd></div>
          <div><dt>Aktivitas tanpa tanggal</dt><dd>{item.undatedCount}</dd></div>
        </dl>
        <div className="directory-detail-section"><h3>Jejak baris operasional</h3><p>Baris kode petak: {item.plotCodeSourceRows.join(", ") || "—"}</p><p>Baris sumber SPK: {item.spkSourceRows.join(", ") || "—"}</p><p>Baris aktivitas: {item.sourceRows.join(", ") || "—"}</p><p>Baris metadata luas: {item.areaSourceRows.join(", ") || "—"}</p></div>
        <div className="directory-detail-actions"><Button variant="outline" onClick={() => onEdit(item)}>Edit draft</Button></div>
        <IssueList issues={item.issues} />
      </> : <>
        <dl className="directory-detail-grid">
          <div><dt>Petak terkait</dt><dd>{item.plotCodes.join(", ") || "Belum tersedia"}</dd></div>
          <div><dt>Luas terverifikasi</dt><dd>{item.verifiedArea === null ? `${item.areaCoverage.verifiedCount}/${item.areaCoverage.totalCount} petak terverifikasi` : `${formatNumber(item.verifiedArea)} Ha`}</dd></div>
          <div><dt>Aktivitas bertanggal · seluruh waktu</dt><dd>{item.activityCount}</dd></div>
          <div><dt>Aktivitas tanpa tanggal</dt><dd>{item.undatedCount}</dd></div>
          <div><dt>HM kerja · seluruh waktu</dt><dd>{formatNumber(item.hours)} jam</dd></div>
          <div><dt>Solar riil · seluruh waktu</dt><dd>{formatNumber(item.fuel)} L</dd></div>
          <div><dt>Rentang aktivitas</dt><dd>{item.startDate ? `${formatDate(item.startDate)} – ${formatDate(item.lastActivityDate!)}` : "Tidak ada tanggal valid"}</dd></div>
          <div><dt>Pendapatan kotor · cocok & terverifikasi</dt><dd>{financialValue(item.finance.gross)}</dd></div>
          <div><dt>Biaya solar · cocok & terverifikasi</dt><dd>{financialValue(item.finance.fuelCost)}</dd></div>
          <div><dt>Margin setelah biaya · pasangan lengkap</dt><dd>{financialValue(item.finance.margin)}</dd></div>
        </dl>
        <div className="directory-detail-section"><h3>Hubungan SPK–petak</h3>{item.relationships.map((relation) => <p key={relation.plot}>{relation.plot}: sumber SPK baris {relation.spkSourceRows.join(", ") || "—"}; operasional baris {relation.operationRows.join(", ") || "—"}; finance baris {relation.financeRows.join(", ") || "tidak ada pasangan"}</p>)}</div>
        <div className="directory-detail-section"><h3>Administrasi SPK</h3><p>Status dokumen dan referensi administrasi tidak tersedia pada worksheet sumber. Status pekerjaan tidak digunakan untuk menyimpulkan status SPK.</p><Button variant="outline" onClick={() => onLinkDocument(item.number)}>Siapkan referensi dokumen</Button></div>
        <IssueList issues={item.issues} />
      </>}
    </section>
  </dialog>;
}

function financialValue(metric: Spk["finance"]["gross"]) {
  return metric.value === null ? "Belum terverifikasi" : `Rp ${formatNumber(metric.value)}${metric.complete ? "" : ` · subtotal ${metric.verifiedCount}/${metric.totalCount}`}`;
}

function IssueList({ issues }: { issues: { severity: string; code: string; message: string; row: number }[] }) {
  return <div className="directory-detail-section"><h3>Kualitas data · {issues.length} temuan</h3>{issues.length ? <ul>{issues.map((issue, index) => <li key={`${issue.code}-${issue.row}-${index}`}>{issue.message} <span>{issue.row}</span></li>)}</ul> : <p>Tidak ada temuan terkait entri ini.</p>}</div>;
}

export function ManagementDirectory({ data, kind, financeAvailable = true }: { data: Directory; kind: "petak" | "spk"; financeAvailable?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "name", direction: 1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Plot | Spk | null>(null);
  const [plotFormOpen, setPlotFormOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<PlotFormInitialValue | null>(null);
  const [adminSpkNumber, setAdminSpkNumber] = useState<string | null>(null);
  const pageSize = 10;
  const rows: (Plot | Spk)[] = kind === "petak" ? data.plots : data.spks;
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("id-ID");
    const filtered = rows.filter((row) => {
      const haystack = kind === "petak"
        ? [(row as Plot).code, ...(row as Plot).spks, (row as Plot).status ?? "", ...(row as Plot).issues.map((issue) => issue.message)].join(" ").toLocaleLowerCase("id-ID")
        : [(row as Spk).number, ...(row as Spk).plotCodes, ...(row as Spk).issues.map((issue) => issue.message)].join(" ").toLocaleLowerCase("id-ID");
      if (term && !haystack.includes(term)) return false;
      if (kind === "petak") {
        const plot = row as Plot;
        if (filter === "review" && !(plot.issues.length > 0 || plot.areaRequiresReview || plot.statusAmbiguous)) return false;
        if (filter === "unknown" && (plot.status !== null || plot.statusAmbiguous)) return false;
        if (!['all', 'review', 'unknown'].includes(filter) && plot.status !== filter) return false;
      }
      if (kind === "spk" && filter === "finance" && !((row as Spk).finance.gross.verifiedCount > 0 || (row as Spk).finance.fuelCost.verifiedCount > 0)) return false;
      if (kind === "spk" && filter === "no-finance" && !((row as Spk).finance.gross.verifiedCount === 0 && (row as Spk).finance.fuelCost.verifiedCount === 0)) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      const a = sortValue(left, kind, sort.key), b = sortValue(right, kind, sort.key);
      return (typeof a === "number" && typeof b === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""), "id-ID", { numeric: true })) * sort.direction;
    });
  }, [rows, kind, filter, query, sort]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalRefill = sumMeasured(data.plots.map((plot) => plot.refill));
  const measuredAreas = data.plots.filter((plot) => !plot.areaRequiresReview && plot.area !== null && Number.isFinite(plot.area) && plot.area >= 0);
  const totalArea = sumMeasured(measuredAreas.map((plot) => plot.area));
  const plotSummary = [
    { label: "Petak terdaftar", value: String(data.plots.length), note: "Inventaris seluruh waktu", icon: MapPinned },
    { label: "Total luas petak", value: totalArea === null ? "Belum tersedia" : `${formatNumber(totalArea)} Ha`, note: measuredAreas.length === data.plots.length ? "Seluruh petak terdaftar" : `${measuredAreas.length} dari ${data.plots.length} petak memiliki luas valid`, icon: Map },
    { label: "Akumulasi HM tervalidasi", value: `${formatNumber(sumMeasured(data.plots.map((plot) => plot.hours)))} jam`, note: "Seluruh riwayat sumber", icon: Clock3 },
    { label: "Pengisian solar", value: totalRefill === null ? "N/A" : `${formatNumber(totalRefill)} L`, note: "Akumulasi pengisian tervalidasi", icon: Fuel },
  ];
  function changeSort(key: SortKey) { setSort((current) => current.key === key ? { key, direction: current.direction === 1 ? -1 : 1 } : { key, direction: 1 }); }
  function sortButton(label: string, key: SortKey) { const active = sort.key === key; const Icon = active ? sort.direction === 1 ? ArrowUp : ArrowDown : null; return <button className="directory-sort" aria-label={`${label}, ${active ? sort.direction === 1 ? "urut naik" : "urut turun" : "urut"}`} onClick={() => changeSort(key)}>{label}{Icon && <Icon size={13} aria-hidden="true" />}</button>; }
  function editPlot(plot: Plot) { setSelected(null); setEditingPlot({ code: plot.code, area: plot.area, spks: plot.spks }); setPlotFormOpen(true); }
  function linkDocument(number: string) { setSelected(null); setAdminSpkNumber(number); }

  return <main className="directory-page">
    <header className="directory-heading"><div><span className="directory-eyebrow">MANAJEMEN DATA · BACA SAJA</span><h1>Petak Lahan</h1><p>{kind === "petak" ? "Inventaris petak dari seluruh baris operasional, termasuk riwayat di luar periode dashboard." : "Ringkasan SPK, petak terkait, aktivitas operasional, dan snapshot Finance yang memiliki pasangan terverifikasi."}</p></div><Badge variant="outline" className="directory-readonly">Google Sheets · read-only</Badge></header>
    {kind === "spk" && !financeAvailable && <p className="directory-notice" role="status">Data operasional tersedia. Snapshot Finance sedang tidak tersedia, sehingga nilai keuangan tidak ditampilkan.</p>}
    {kind === "spk" && <section className="directory-admin-notice"><div><h2>Administrasi SPK</h2><p>Status dokumen dan referensi administrasi belum tersedia pada worksheet sumber. Ringkasan pekerjaan di bawah tidak digunakan untuk menyimpulkan status SPK. Buka detail SPK untuk menyiapkan draft referensi.</p></div></section>}
    {kind === "petak" && <section className="plot-list-summary" aria-label="Ringkasan inventaris petak">{plotSummary.map(({ label, value, note, icon: Icon }) => <Card key={label} className="plot-list-kpi"><CardHeader><CardTitle><span><Icon aria-hidden="true" /></span>{label}</CardTitle></CardHeader><CardContent><strong>{value}</strong><small>{note}</small></CardContent></Card>)}</section>}
    {kind === "petak" ? <PlotDataTable data={data} onAdd={() => { setEditingPlot(null); setPlotFormOpen(true); }} /> : <>
      <section className="directory-toolbar" aria-label="Cari dan filter data SPK">
        <label className="directory-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Cari nomor SPK atau kode petak</span><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nomor SPK atau petak" /></label>
        <label className="directory-filter">Snapshot Finance<select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="all">Semua</option><option value="finance">Ada nilai terverifikasi</option><option value="no-finance">Belum ada nilai terverifikasi</option></select></label>
        <span className="directory-count">{visible.length} SPK · {data.qualityIssueCount} temuan sumber</span><Button size="sm" onClick={() => setAdminSpkNumber("")}>Tambah SPK</Button>
      </section>
      <section className="directory-table-panel" aria-label="Daftar SPK">
        <Table><TableHeader><TableRow><TableHead>{sortButton("Nomor SPK", "name")}</TableHead><TableHead>Petak terkait</TableHead><TableHead>{sortButton("Luas terverifikasi (Ha)", "area")}</TableHead><TableHead>{sortButton("Aktivitas", "activity")}</TableHead><TableHead>{sortButton("HM (Jam)", "hours")}</TableHead><TableHead>{sortButton("Solar riil (L)", "fuel")}</TableHead><TableHead>{sortButton("Pendapatan kotor", "revenue")}</TableHead><TableHead>Biaya solar</TableHead><TableHead>Kualitas</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>{pageRows.map((row) => { const spk = row as Spk; return <TableRow key={spk.number}>
          <TableCell className="directory-primary-cell">{spk.number}</TableCell><TableCell><strong>{spk.plotCodes.length} petak</strong>{spk.plotCodes.length > 0 && <><br />{spk.plotCodes.join(", ")}</>}</TableCell><TableCell>{spk.verifiedArea === null ? `${spk.areaCoverage.verifiedCount}/${spk.areaCoverage.totalCount} valid` : formatNumber(spk.verifiedArea)}</TableCell><TableCell>{spk.activityCount}</TableCell><TableCell>{formatNumber(spk.hours)}</TableCell><TableCell>{formatNumber(spk.fuel)}</TableCell><TableCell>{financialValue(spk.finance.gross)}</TableCell><TableCell>{financialValue(spk.finance.fuelCost)}</TableCell><TableCell><QualityBadge count={spk.issues.length} /></TableCell><TableCell><div className="directory-row-actions"><Button variant="outline" size="sm" onClick={() => setSelected(spk)}>Detail</Button><Button variant="outline" size="sm" onClick={() => setAdminSpkNumber(spk.number)}>Edit draft</Button></div></TableCell>
        </TableRow>; })}</TableBody></Table>
        {!pageRows.length && <div className="directory-empty"><strong>{rows.length ? "Tidak ada data yang cocok" : "Belum ada data untuk ditampilkan"}</strong><p>{rows.length ? "Ubah kata pencarian atau filter." : "Daftar hanya memuat data sumber Google Sheets yang berhasil dinormalisasi."}</p></div>}
        <footer className="directory-pagination"><span>Halaman {currentPage} dari {totalPages} · {visible.length} entri</span><div><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Berikutnya</Button></div></footer>
      </section>
    </>}
    <p className="directory-footnote">Ringkasan operasional menggunakan rekaman valid dan tidak duplikat. Status petak memakai riwayat seluruh tanggal. Data bertanggal kosong tidak dihitung sebagai aktivitas bertanggal.</p>
    <Drawer item={selected} close={() => setSelected(null)} onEdit={editPlot} onLinkDocument={linkDocument} />
    {kind === "petak" && plotFormOpen && <PlotFormDialog initial={editingPlot} existingPlotCodes={data.plots.map((plot) => plot.code)} existingSpkNumbers={data.spks.map((spk) => spk.number)} onClose={() => { setPlotFormOpen(false); setEditingPlot(null); }} />}
    {kind === "spk" && adminSpkNumber !== null && <SpkFormDialog key={adminSpkNumber || "new"} initialNumber={adminSpkNumber} existingNumbers={data.spks.map((spk) => spk.number)} plotOptions={data.plots.map((plot) => plot.code)} onClose={() => setAdminSpkNumber(null)} />}
  </main>;
}

function sortValue(row: Plot | Spk, kind: "petak" | "spk", key: SortKey): string | number | null {
  if (kind === "petak") {
    const plot = row as Plot;
    return ({ name: plot.code, area: plot.area, status: plot.status, activity: plot.lastActivityDate, hours: plot.hours, fuel: plot.fuel, revenue: null })[key];
  }
  const spk = row as Spk;
  return ({ name: spk.number, area: spk.verifiedArea, status: null, activity: spk.activityCount, hours: spk.hours, fuel: spk.fuel, revenue: spk.finance.gross.value })[key];
}
