"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { Activity, ArrowLeft, Clock3, FileText, Fuel, MapPinned, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/features/dashboard/lib/format";
import type { FuelWithdrawal, summarizePlotPurchases } from "@/features/dashboard/lib/fuel-withdrawals";
import type { FuelPriceCatalog } from "@/features/dashboard/lib/fuel-price";
import { PlotPurchaseHistory } from "./plot-purchase-history";
import { ActivityFormDialog } from "@/features/activities/components/activity-form-dialog";
import { FuelFormDialog } from "@/features/fuel/components/fuel-form-dialog";
import { PlotFormDialog } from "./plot-form-dialog";
import type { buildManagementDirectory } from "../lib/build-management-directory";
import type { calculatePlotPrice } from "../lib/plot-price";

type Plot = ReturnType<typeof buildManagementDirectory>["plots"][number];
type Tab = "activities" | "purchases";
const tabs: { id: Tab; label: string }[] = [
  { id: "activities", label: "Aktivitas operasional" },
  { id: "purchases", label: "Riwayat pembelian solar" },
];
const sourceStatusLabels: Record<string, string> = {
  "Mulai pengerjaan": "Mulai Garap Petak",
  "Dalam pengerjaan": "Garap Petak Berlangsung",
  Selesai: "Garap Petak Selesai",
};
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(value);
const hectares = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 }).format(value);

export function PlotDetailPage({ plot, plotPrice, purchases, purchaseRecords, priceCatalog, plotCodes, spkNumbers }: { plot: Plot; plotPrice: ReturnType<typeof calculatePlotPrice>; purchases: ReturnType<typeof summarizePlotPurchases>; purchaseRecords: FuelWithdrawal[]; priceCatalog: FuelPriceCatalog | null; plotCodes: string[]; spkNumbers: string[] }) {
  const [tab, setTab] = useState<Tab>("activities");
  const [activityDraft, setActivityDraft] = useState<{ initial?: [string, string][]; key: string } | null>(null);
  const [fuelFormOpen, setFuelFormOpen] = useState(false);
  const [plotForm, setPlotForm] = useState<"general" | "spk" | "berita" | "disbursement" | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const completedOrUnclear = plot.status === "Selesai" || plot.statusAmbiguous;
  const summary = [
    { label: "Luas petak", value: plot.area === null ? "N/A" : `${formatNumber(plot.area)} Ha`, icon: MapPinned },
    { label: "Aktivitas bertanggal", value: String(plot.activityCount), icon: Activity, note: plot.undatedCount ? `${plot.undatedCount} baris tanpa tanggal` : undefined },
    { label: "HM kerja tervalidasi", value: `${formatNumber(plot.hours)} jam`, icon: Clock3 },
    { label: "Pengisian solar", value: plot.refill === null ? "N/A" : `${formatNumber(plot.refill)} L`, icon: Fuel, note: "Aktivitas operasional tervalidasi" },
    { label: "Pembelian solar", value: purchases.liters === null ? "N/A" : `${formatNumber(purchases.liters)} L`, icon: Fuel, note: !purchases.available ? "Data pembelian belum tersedia" : purchases.invalidRows ? `${purchases.count} transaksi cocok · ${purchases.invalidRows} baris sumber perlu ditinjau` : purchases.count === 0 ? "Belum ada transaksi dengan kode petak ini" : `${purchases.count} transaksi petak` },
  ];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  function editActivity(activity: Plot["activities"][number]) {
    setActivityDraft({ key: `edit-${activity.sourceRow}`, initial: [
      ["Tanggal aktivitas", activity.date ?? ""], ["Kode petak", plot.code], ["HM awal", rawNumber(activity.hmStart)], ["HM akhir", rawNumber(activity.hmEnd)],
      ["HM kerja", rawNumber(activity.workingHours)], ["Estimasi jam kerja", rawNumber(activity.estimatedWorkingHours)], ["Status pekerjaan", activity.workStatus ?? ""], ["Keterangan", activity.notes ?? ""],
    ] });
  }

  return <main className="plot-detail-page">
    <nav className="plot-detail-breadcrumb" aria-label="Breadcrumb"><Link href="/petak"><ArrowLeft size={16} aria-hidden="true" /> Petak Lahan</Link><span aria-hidden="true">/</span><span>{plot.code}</span></nav>
    <header className="plot-detail-heading"><div><span className="directory-eyebrow">RINCIAN PETAK</span><div className="plot-heading-meta"><h1>{plot.code}</h1><div className="plot-heading-price"><span>Nilai petak</span><strong>{plotPrice ? rupiah(plotPrice.amount) : "Belum tersedia"}</strong></div><div className="plot-heading-price"><span>Setelah pajak 2%</span><strong>{plotPrice ? rupiah(plotPrice.afterTax) : "Belum tersedia"}</strong></div></div><div className="plot-detail-status"><Badge variant="outline" className={plot.statusAmbiguous ? "directory-quality" : plot.status === "Selesai" ? "plot-status-complete" : ""}>{plot.statusAmbiguous ? "Status perlu ditinjau" : sourceStatusLabels[plot.status ?? ""] ?? plot.status ?? "Belum diketahui"}</Badge><span>{plot.spks.length ? `SPK ${plot.spks.join(", ")}` : "SPK belum tersedia"}</span></div>{plotPrice && <p className="plot-price-calculation">{rupiah(plotPrice.pricePerHa)} / Ha × {hectares(plotPrice.area)} Ha · Potongan pajak 2%: {rupiah(plotPrice.tax)}</p>}</div><div className="plot-detail-actions"><Button variant="outline" onClick={() => setPlotForm("general")}><Pencil data-icon="inline-start" />Edit petak</Button><Button variant="outline" onClick={() => setFuelFormOpen(true)}><Plus data-icon="inline-start" />Tambah pengisian</Button><Button onClick={() => setActivityDraft({ key: "new" })} disabled={completedOrUnclear} title={completedOrUnclear ? "Petak selesai atau statusnya belum pasti; alur buka kembali belum tersedia." : undefined}><Plus data-icon="inline-start" />Tambah aktivitas</Button></div></header>
    {completedOrUnclear && <p className="directory-notice" role="status">{plot.status === "Selesai" ? "Petak sudah selesai. Aktivitas biasa ditahan sampai alur buka kembali tersedia." : "Status terakhir ambigu. Periksa riwayat sumber sebelum menambah aktivitas."}</p>}
    <section className="plot-summary-grid" aria-label="Ringkasan petak">{summary.map(({ label, value, icon: Icon, note }) => <Card key={label} className="plot-summary-card"><CardHeader><CardTitle><Icon aria-hidden="true" />{label}</CardTitle></CardHeader><CardContent><strong>{value}</strong>{note && <span>{note}</span>}</CardContent></Card>)}</section>
    <section className="plot-timeline" aria-label="Status dan tanggal petak"><div><span>Status terbaru</span><strong className={!plot.statusAmbiguous && plot.status === "Selesai" ? "plot-status-complete" : undefined}>{plot.statusAmbiguous ? "Perlu tinjauan" : sourceStatusLabels[plot.status ?? ""] ?? plot.status ?? "Belum diketahui"}</strong></div><div><span>Mulai garap terkonfirmasi</span><strong>{plot.startDate ? formatDate(plot.startDate) : "Belum tercatat"}</strong></div><div><span>Selesai terkonfirmasi</span><strong>{plot.completionDate ? formatDate(plot.completionDate) : "Belum tercatat"}</strong></div>
    <div className="plot-documents" aria-labelledby="plot-documents-title"><h2 id="plot-documents-title">Dokumen petak</h2><p>Status dokumen belum tersedia. File yang dipilih masih berupa draft dan belum tersimpan.</p><div className="plot-documents-actions">{([{ key: "spk", label: "SPK" }, { key: "berita", label: "Berita Acara" }, { key: "disbursement", label: "Bukti Pencairan" }] as const).map(({ key, label }) => <div className="plot-document-item" key={key}><span><FileText aria-hidden="true" />{label}</span><Button variant="outline" size="sm" aria-label={`Pilih file ${label} sebagai draft`} onClick={() => setPlotForm(key)}>Pilih file</Button></div>)}</div></div></section>
    {plot.campaignRequiresReview && <p className="directory-notice" role="status">Ada {plot.startEventCount} event mulai pada riwayat petak ini. Sumber belum memiliki ID kampanye atau event buka kembali, jadi total ditandai sebagai akumulasi seluruh rekaman tervalidasi dan tidak dipisah menjadi kampanye.</p>}
    <section className="plot-history-panel">
      <div className="plot-tabs" role="tablist" aria-label="Riwayat petak">{tabs.map(({ id, label }, index) => <button key={id} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`plot-tab-${id}`} aria-selected={tab === id} aria-controls={`plot-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={(event) => onTabKeyDown(event, index)}>{label}{id === "activities" && <span>{plot.activities.length}</span>}{id === "purchases" && <span>{purchases.count}</span>}</button>)}</div>
      <div id={`plot-panel-${tab}`} role="tabpanel" aria-labelledby={`plot-tab-${tab}`} tabIndex={0} className="plot-tab-panel">
        {tab === "activities" && <section aria-label="Riwayat aktivitas">
          <div className="plot-panel-heading"><div><h2>Riwayat aktivitas operasional</h2><p>Diurutkan menurut tanggal sumber; tanggal kosong ditempatkan setelah catatan bertanggal.</p></div><Button size="sm" onClick={() => setActivityDraft({ key: "new" })} disabled={completedOrUnclear} title={completedOrUnclear ? "Petak selesai atau statusnya belum pasti; alur buka kembali belum tersedia." : undefined}>Tambah aktivitas</Button></div>
          <div className="directory-table-panel plot-history-table"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead>HM awal → akhir (jam)</TableHead><TableHead>HM kerja / estimasi (jam)</TableHead><TableHead>Pengisian solar (L)</TableHead><TableHead>Keterangan</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
            <TableBody>{plot.activities.map((activity) => {
              const statusClass = activity.workStatus === "Mulai pengerjaan" ? "is-started" : activity.workStatus === "Dalam pengerjaan" ? "is-progress" : activity.workStatus === "Selesai" ? "is-completed" : "";
              const date = activity.date ? formatDate(activity.date, { day: "numeric", month: "short", year: "numeric" }) : "tanggal tidak tersedia";
              return <TableRow key={`${plot.id}-${activity.sourceRow}`}><TableCell>{activity.date ? date : "Tidak tersedia"}</TableCell><TableCell><Badge variant="outline" className={`plot-activity-status ${statusClass}`}>{activity.workStatus ? sourceStatusLabels[activity.workStatus] ?? activity.workStatus : "Belum diketahui"}</Badge></TableCell><TableCell>{measurement(activity.hmStart, activity.invalidFields.includes("hmStart"))} → {measurement(activity.hmEnd, activity.invalidFields.includes("hmEnd"))}</TableCell><TableCell>{measurement(activity.workingHours, activity.invalidFields.includes("workingHours"))} / {formatNumber(activity.estimatedWorkingHours)}</TableCell><TableCell>{measurement(activity.fuelRefill, activity.invalidFields.includes("fuelRefill"))}</TableCell><TableCell className="plot-activity-notes">{activity.notes || "—"}</TableCell><TableCell><Button size="icon-sm" variant="outline" aria-label={`Edit draft aktivitas ${date}, baris ${activity.sourceRow}`} title="Edit draft" onClick={() => editActivity(activity)}><Pencil aria-hidden="true" /></Button></TableCell></TableRow>;
            })}</TableBody></Table>{!plot.activities.length && <div className="directory-empty"><strong>Belum ada catatan aktivitas sumber</strong><p>Aktivitas baru dapat disiapkan sebagai draft jika petak belum selesai.</p></div>}</div>
        </section>}
        {tab === "purchases" && <PlotPurchaseHistory records={purchaseRecords} available={purchases.available} invalidRows={purchases.invalidRows} priceCatalog={priceCatalog} />}
      </div>
    </section>
    <p className="directory-footnote">Ringkasan HM dan pengisian memakai aktivitas bertanggal yang tervalidasi dan mengecualikan duplikat. Pembelian dihitung dari transaksi berkode petak yang sama. Riwayat dapat mencakup baris duplikat; ringkasan tidak menghitungnya. Koreksi historis tidak menggantikan baris lama, dan sumber belum memisahkan kampanye kerja.</p>
    {activityDraft && <ActivityFormDialog key={activityDraft.key} initial={activityDraft.initial} plotCode={plot.code} plotCodes={plotCodes} onClose={() => setActivityDraft(null)} />}
    {fuelFormOpen && <FuelFormDialog key="new-refill" plotCode={plot.code} plotCodes={plotCodes} onClose={() => setFuelFormOpen(false)} />}
    {plotForm && <PlotFormDialog key={plotForm} initial={{ code: plot.code, area: plot.area, spks: plot.spks }} initialDocument={plotForm === "general" ? undefined : plotForm} existingPlotCodes={plotCodes} existingSpkNumbers={spkNumbers} onClose={() => setPlotForm(null)} />}
  </main>;
}

function rawNumber(value: number | null) { return value === null ? "" : String(value); }
function measurement(value: number | null, invalid: boolean) { return invalid ? "Perlu tinjauan" : formatNumber(value); }
