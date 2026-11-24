"use client";

import Link from "next/link";
import { Toast } from "@base-ui/react/toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Activity, ArrowLeft, CheckCircle2, Clock3, Eye, FileText, FileUp, Fuel, MapPinned, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/features/dashboard/lib/format";
import type { FuelWithdrawal, summarizePlotPurchases } from "@/features/dashboard/lib/fuel-withdrawals";
import { resolveWithdrawalPricing, type FuelPriceCatalog } from "@/features/dashboard/lib/fuel-price";
import { PlotPurchaseHistory } from "./plot-purchase-history";
import { ActivityFormDialog } from "@/features/activities/components/activity-form-dialog";
import { updatePlotActivity } from "../actions/save-plot";
import { activityEditDraft, latestDatedPlotActivity, type PlotActivity } from "../lib/plot-activity-edit";
import { ActivityDetail } from "./activity-detail-dialog";
import { DeleteActivityDialog } from "./delete-activity-dialog";
import { DeletePlotDialog } from "./delete-plot-dialog";
import { PlotActionDialog } from "./plot-action-dialog";
import { PlotEntryDialog } from "./plot-entry-dialog";
import { PlotFormDialog } from "./plot-form-dialog";
import type { buildManagementDirectory } from "../lib/build-management-directory";
import type { calculatePlotPrice } from "../lib/plot-price";
import type { SpkDocumentRecord } from "../lib/spk-document-folders";
import { SpkFormDialog } from "./spk-form-dialog";

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

export function PlotDetailPage({ worksheet, plot, plotPrice, purchases, purchaseRecords, priceCatalog, plotCodes, writerReady, spkWriterReady, canWrite, canInput, authReady, userEmail, spkDocuments, spkDocumentsAvailable, pickerApiKey, cloudProjectNumber, cloudClientId }: { worksheet: string | null; plot: Plot; plotPrice: ReturnType<typeof calculatePlotPrice>; purchases: ReturnType<typeof summarizePlotPurchases>; purchaseRecords: FuelWithdrawal[]; priceCatalog: FuelPriceCatalog | null; plotCodes: string[]; writerReady: boolean; spkWriterReady: boolean; canWrite: boolean; canInput: boolean; authReady: boolean; userEmail: string | null; spkDocuments: Record<string, SpkDocumentRecord>; spkDocumentsAvailable: boolean; pickerApiKey: string; cloudProjectNumber: string; cloudClientId: string }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [tab, setTab] = useState<Tab>("activities");
  const [readingActivity, setReadingActivity] = useState<Plot["activities"][number] | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<PlotActivity | null>(null);
  const [activityDraft, setActivityDraft] = useState<PlotActivity | null>(null);
  const [closing, setClosing] = useState<PlotActivity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState(false);
  const [adminSpkNumber, setAdminSpkNumber] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ title: string; url: string } | null>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const canEditActivity = canInput && writerReady;
  const canManagePlot = canWrite && writerReady && plot.sheetSourceRow !== null;
  const latestActivity = latestDatedPlotActivity(plot.activities);
  const closeActivity = plot.status !== "Selesai" ? latestActivity?.sheetActivity : null;
  const completedOrUnclear = plot.status === "Selesai" || plot.statusAmbiguous;
  const lastHm = plot.activities.reduce<typeof plot.activities[number] | null>((latest, activity) => {
    if (activity.duplicateOf !== null || !activity.date || activity.hmEnd === null || activity.invalidFields.includes("hmEnd")) return latest;
    return !latest || activity.date > latest.date! || (activity.date === latest.date && activity.sourceRow > latest.sourceRow) ? activity : latest;
  }, null);
  const summary = [
    { label: "Luas petak", value: plot.area === null ? "N/A" : `${formatNumber(plot.area)} Ha`, icon: MapPinned },
    { label: "Aktivitas bertanggal", value: String(plot.activityCount), icon: Activity, note: plot.undatedCount ? `${plot.undatedCount} baris tanpa tanggal` : undefined },
    { label: "HM kerja tervalidasi", value: `${formatNumber(plot.hours)} jam`, icon: Clock3 },
    { label: "Pengisian solar", value: plot.refill === null ? "N/A" : `${formatNumber(plot.refill)} L`, icon: Fuel, note: "Aktivitas operasional tervalidasi" },
    { label: "Pembelian solar", value: purchases.liters === null ? "N/A" : `${formatNumber(purchases.liters)} L`, icon: Fuel, note: !purchases.available ? "Data pembelian belum tersedia" : purchases.invalidRows ? `${purchases.count} transaksi cocok · ${purchases.invalidRows} baris sumber perlu ditinjau` : purchases.count === 0 ? "Belum ada transaksi dengan kode petak ini" : `${purchases.count} transaksi petak` },
  ];

  useEffect(() => {
    const dialog = previewDialog.current;
    if (!dialog) return;
    if (previewDocument && !dialog.open) dialog.showModal();
    if (!previewDocument && dialog.open) dialog.close();
  }, [previewDocument]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  return <main className="plot-detail-page">
    <nav className="plot-detail-breadcrumb" aria-label="Breadcrumb"><Link href="/petak"><ArrowLeft size={16} aria-hidden="true" /> Petak Lahan</Link><span aria-hidden="true">/</span><span>{plot.code}</span></nav>
    <header className="plot-detail-heading">
      <div><span className="directory-eyebrow">RINCIAN PETAK</span><div className="plot-heading-meta"><h1>{plot.code}</h1><div className="plot-heading-price"><span>Nilai petak</span><strong>{plotPrice ? rupiah(plotPrice.amount) : "Belum tersedia"}</strong></div><div className="plot-heading-price"><span>Setelah pajak 2%</span><strong>{plotPrice ? rupiah(plotPrice.afterTax) : "Belum tersedia"}</strong></div></div><div className="plot-detail-status"><Badge variant="outline" className={plot.statusAmbiguous ? "directory-quality" : plot.status === "Selesai" ? "plot-status-complete" : ""}>{plot.statusAmbiguous ? "Status perlu ditinjau" : sourceStatusLabels[plot.status ?? ""] ?? plot.status ?? "Belum diketahui"}</Badge><span>{plot.spks.length ? `SPK ${plot.spks.join(", ")}` : "SPK belum tersedia"}</span></div>{plotPrice && <p className="plot-price-calculation">{rupiah(plotPrice.pricePerHa)} / Ha × {hectares(plotPrice.area)} Ha · Potongan pajak 2%: {rupiah(plotPrice.tax)}</p>}</div>
      <div className="plot-detail-actions">
        {canEditActivity && closeActivity && <Button variant="outline" onClick={() => setClosing(closeActivity)}><CheckCircle2 data-icon="inline-start" aria-hidden="true" />Tutup petak</Button>}
        {canManagePlot && <Button variant="destructive" className="plot-delete-action" onClick={() => setDeleting(true)}><Trash2 data-icon="inline-start" aria-hidden="true" />Hapus petak</Button>}
        {canManagePlot && <Button variant="outline" onClick={() => setEditingPlot(true)}><Pencil data-icon="inline-start" aria-hidden="true" />Edit petak</Button>}
        <Button onClick={() => setEntryFormOpen(true)}><Plus data-icon="inline-start" />Tambah catatan</Button>
      </div>
    </header>
    {completedOrUnclear && <p className="directory-notice" role="status">{plot.status === "Selesai" ? "Petak sudah selesai. Aktivitas biasa ditahan sampai alur buka kembali tersedia." : "Status terakhir ambigu. Periksa riwayat sumber sebelum menambah aktivitas."}</p>}
    <section className="plot-summary-grid" aria-label="Ringkasan petak">{summary.map(({ label, value, icon: Icon, note }) => <Card key={label} className="plot-summary-card"><CardHeader><CardTitle><Icon aria-hidden="true" />{label}</CardTitle></CardHeader><CardContent><strong>{value}</strong>{note && <span>{note}</span>}</CardContent></Card>)}</section>
    <section className="plot-timeline" aria-label="Status dan tanggal petak"><div><span>Status terbaru</span><strong className={!plot.statusAmbiguous && plot.status === "Selesai" ? "plot-status-complete" : undefined}>{plot.statusAmbiguous ? "Perlu tinjauan" : sourceStatusLabels[plot.status ?? ""] ?? plot.status ?? "Belum diketahui"}</strong></div><div><span>Mulai garap terkonfirmasi</span><strong>{plot.startDate ? formatDate(plot.startDate) : "Belum tercatat"}</strong></div><div><span>Selesai terkonfirmasi</span><strong>{plot.completionDate ? formatDate(plot.completionDate) : "Belum tercatat"}</strong></div>
    <div className="plot-documents" aria-labelledby="plot-documents-title"><h2 id="plot-documents-title">Dokumen petak</h2>{!spkDocumentsAvailable ? <p>Status dokumen tidak dapat dibaca dari worksheet Administrasi SPK.</p> : plot.spks.length ? <p>Dokumen tetap bisa diunggah setelah petak selesai.</p> : <p>Nomor SPK belum tersedia.{canManagePlot && <> Tambahkan lewat <strong>Edit petak</strong>.</>}</p>}{spkDocumentsAvailable && plot.spks.map((number) => { const record = spkDocuments[number]; return <section className="plot-documents-spk" key={number}><header><strong>SPK {number}</strong>{canWrite && <Button size="sm" variant="outline" onClick={() => setAdminSpkNumber(number)}>Kelola nomor dan dokumen</Button>}</header><div className="plot-documents-actions">{[{ label: "SPK", url: record?.spkUrl }, { label: "Berita Acara", url: record?.beritaAcaraUrl }, { label: "Bukti Pencairan", url: record?.payoutUrl }].map(({ label, url }) => <div className="plot-document-item" key={label}><span><FileText aria-hidden="true" />{label}</span>{url ? <Button size="sm" variant="outline" onClick={() => setPreviewDocument({ title: `${label} · SPK ${number}`, url })}><Eye data-icon="inline-start" />Lihat dokumen</Button> : canWrite ? <Button size="sm" variant="outline" onClick={() => setAdminSpkNumber(number)}><FileUp data-icon="inline-start" />Unggah</Button> : <span>Belum tersedia</span>}</div>)}</div></section>; })}</div></section>
    {plot.campaignRequiresReview && <p className="directory-notice" role="status">Ada {plot.startEventCount} event mulai pada riwayat petak ini. Sumber belum memiliki ID kampanye atau event buka kembali, jadi total ditandai sebagai akumulasi seluruh rekaman tervalidasi dan tidak dipisah menjadi kampanye.</p>}
    <section className="plot-history-panel">
      <div className="plot-tabs" role="tablist" aria-label="Riwayat petak">{tabs.map(({ id, label }, index) => <button key={id} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`plot-tab-${id}`} aria-selected={tab === id} aria-controls={`plot-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={(event) => onTabKeyDown(event, index)}>{label}{id === "activities" && <span>{plot.activities.length}</span>}{id === "purchases" && <span>{purchases.count}</span>}</button>)}</div>
      <div id={`plot-panel-${tab}`} role="tabpanel" aria-labelledby={`plot-tab-${tab}`} tabIndex={0} className="plot-tab-panel">
        {tab === "activities" && <section aria-label="Riwayat aktivitas">
          <div className="plot-panel-heading"><div><h2>Riwayat aktivitas operasional</h2><p>Diurutkan menurut tanggal sumber; tanggal kosong ditempatkan setelah catatan bertanggal.</p></div></div>
          <div className="directory-table-panel plot-history-table"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead>HM awal → akhir (jam)</TableHead><TableHead>HM kerja / estimasi (jam)</TableHead><TableHead>Pengisian solar (L)</TableHead><TableHead>Pemakaian solar per jam (L/jam)</TableHead><TableHead>Keterangan</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
            <TableBody>{plot.activities.map((activity) => {
              const statusClass = activity.workStatus === "Mulai pengerjaan" ? "is-started" : activity.workStatus === "Dalam pengerjaan" ? "is-progress" : activity.workStatus === "Selesai" ? "is-completed" : "";
              const date = activity.date ? formatDate(activity.date, { day: "numeric", month: "short", year: "numeric" }) : "tanggal tidak tersedia";
              return <TableRow key={`${plot.id}-${activity.sheetActivity ? "sheet" : "overview"}-${activity.sourceRow}`}><TableCell>{activity.date ? date : "Tidak tersedia"}</TableCell><TableCell><Badge variant="outline" className={`plot-activity-status ${statusClass}`}>{activity.workStatus ? sourceStatusLabels[activity.workStatus] ?? activity.workStatus : "Belum diketahui"}</Badge></TableCell><TableCell>{measurement(activity.hmStart, activity.invalidFields.includes("hmStart"))} → {measurement(activity.hmEnd, activity.invalidFields.includes("hmEnd"))}</TableCell><TableCell>{measurement(activity.workingHours, activity.invalidFields.includes("workingHours"))} / {formatNumber(activity.estimatedWorkingHours)}</TableCell><TableCell>{measurement(activity.fuelRefill, activity.invalidFields.includes("fuelRefill"))}</TableCell><TableCell>{activity.fuelPerHour === null ? "Belum diisi" : `${formatNumber(activity.fuelPerHour)} L/jam`}</TableCell><TableCell className="plot-activity-notes">{activity.notes || "—"}</TableCell><TableCell><div className="directory-row-actions">
                <Button size="icon-sm" variant="outline" className="plot-detail-link" aria-label={`Lihat detail aktivitas ${date}, baris ${activity.sourceRow}`} title="Lihat detail aktivitas" onClick={() => setReadingActivity(activity)}><Eye aria-hidden="true" /></Button>
                {canEditActivity && activity.sheetActivity && <Button size="icon-sm" variant="outline" aria-label={`Edit aktivitas ${date}, baris ${activity.sourceRow}`} title="Edit aktivitas" onClick={() => setActivityDraft(activity.sheetActivity)}><Pencil aria-hidden="true" /></Button>}
                {canWrite && writerReady && activity.sheetActivity && <Button size="icon-sm" variant="destructive" className="plot-delete-action" aria-label={`Hapus aktivitas ${date}, baris ${activity.sourceRow}`} title="Hapus aktivitas" onClick={() => setDeletingActivity(activity.sheetActivity)}><Trash2 aria-hidden="true" /></Button>}
              </div></TableCell></TableRow>;
            })}</TableBody></Table>{!plot.activities.length && <div className="directory-empty"><strong>Belum ada catatan aktivitas sumber</strong><p>Aktivitas baru dapat disiapkan sebagai draft jika petak belum selesai.</p></div>}</div>
        </section>}
        {tab === "purchases" && <PlotPurchaseHistory records={purchaseRecords} available={purchases.available} invalidRows={purchases.invalidRows} priceCatalog={priceCatalog} />}
      </div>
    </section>
    <p className="directory-footnote">Ringkasan HM dan pengisian memakai aktivitas bertanggal yang tervalidasi dan mengecualikan duplikat. Pembelian dihitung dari transaksi berkode petak yang sama. Riwayat dapat mencakup baris duplikat; ringkasan tidak menghitungnya.</p>
    {readingActivity && <ActivityDetail close={() => setReadingActivity(null)} row={{
      plot: plot.code, spk: plot.spks.join(", "), date: readingActivity.date ?? "", status: readingActivity.workStatus ?? "",
      details: [
        ["HM awal", measurement(readingActivity.hmStart, readingActivity.invalidFields.includes("hmStart"))],
        ["HM akhir", measurement(readingActivity.hmEnd, readingActivity.invalidFields.includes("hmEnd"))],
        ["HM kerja", measurement(readingActivity.workingHours, readingActivity.invalidFields.includes("workingHours"))],
        ["Estimasi jam kerja", formatNumber(readingActivity.estimatedWorkingHours)],
        ["Pengisian solar", measurement(readingActivity.fuelRefill, readingActivity.invalidFields.includes("fuelRefill"))],
        ["Pemakaian solar riil", measurement(readingActivity.actualFuelUsage, readingActivity.invalidFields.includes("actualFuelUsage"))],
        ["Pemakaian solar per jam", measurement(readingActivity.fuelPerHour, readingActivity.invalidFields.includes("fuelPerHour"))],
        ["Keterangan", readingActivity.notes ?? ""],
      ],
      purchases: purchases.available ? {
        invalidRows: purchases.invalidRows,
        records: purchaseRecords.filter(({ date }) => date === readingActivity.date).map((record) => ({ liters: record.liters, pricing: resolveWithdrawalPricing(record, priceCatalog) })),
      } : null,
    }} />}
    {deletingActivity && <DeleteActivityDialog code={plot.code} activity={deletingActivity} onClose={() => setDeletingActivity(null)} />}
    {activityDraft && <ActivityFormDialog key={activityDraft.sourceRow} activity={activityDraft} plotCode={plot.code} worksheet={worksheet} onClose={() => setActivityDraft(null)} />}
    {deleting && plot.sheetSourceRow !== null && <DeletePlotDialog code={plot.code} sourceRow={plot.sheetSourceRow} onClose={() => setDeleting(false)} />}
    {closing && <PlotActionDialog title={`Tutup petak ${plot.code}?`}
      description={`Aktivitas pada ${formatDate(closing.date!, { day: "numeric", month: "long", year: "numeric" })} akan ditandai selesai.`}
      actionLabel="Tutup petak" onClose={() => setClosing(null)} onConfirm={async () => {
        const result = await updatePlotActivity({ code: plot.code, sourceRow: closing.sourceRow, snapshot: JSON.stringify(closing), draft: activityEditDraft(closing), close: true });
        if (result.ok) {
          toast.add({ title: result.message, type: "success" });
          setClosing(null);
          router.refresh();
        }
        return result;
      }} />}
    {entryFormOpen && <PlotEntryDialog key={plot.code} worksheet={worksheet} plotCode={plot.code} previousHm={lastHm ? { value: lastHm.hmEnd!, sourceRow: lastHm.sourceRow } : null} activityDisabled={completedOrUnclear} writerReady={writerReady} canWrite={canInput} authReady={authReady} userEmail={userEmail} onClose={() => setEntryFormOpen(false)} />}
    {editingPlot && <PlotFormDialog initial={null} editing={plot} existingPlotCodes={plotCodes} writerReady={writerReady} canWrite={canWrite} authReady={authReady} userEmail={userEmail} onClose={() => setEditingPlot(false)} />}
    {adminSpkNumber && <SpkFormDialog key={adminSpkNumber} initialNumber={adminSpkNumber} existingNumbers={plot.spks} initialRecord={spkDocuments[adminSpkNumber] ?? null} canWrite={canWrite} writerReady={spkWriterReady} authReady={authReady} pickerApiKey={pickerApiKey} cloudProjectNumber={cloudProjectNumber} cloudClientId={cloudClientId} onClose={() => { setAdminSpkNumber(null); router.refresh(); }} />}
    <dialog ref={previewDialog} className="plot-document-preview" aria-label={previewDocument?.title ?? "Pratinjau dokumen"} onCancel={(event) => { event.preventDefault(); setPreviewDocument(null); }} onClick={(event) => { if (event.target === event.currentTarget) setPreviewDocument(null); }}><header><div><span>PRATINJAU DOKUMEN</span><h2>{previewDocument?.title}</h2></div><div className="plot-document-preview-actions">{previewDocument && <a href={previewDocument.url} target="_blank" rel="noreferrer">Buka di Drive</a>}<Button variant="ghost" size="icon" aria-label="Tutup pratinjau" onClick={() => setPreviewDocument(null)}><X /></Button></div></header>{previewDocument && <iframe title={previewDocument.title} src={drivePreviewUrl(previewDocument.url)} />}</dialog>
  </main>;
}

function measurement(value: number | null, invalid: boolean) { return invalid ? "Perlu tinjauan" : formatNumber(value); }
function drivePreviewUrl(link: string) { try { const url = new URL(link); const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id"); return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : link; } catch { return link; } }
