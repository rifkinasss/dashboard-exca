"use client";

import { Toast } from "@base-ui/react/toast";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { saveFuelPrice } from "../actions/save-fuel-price";
import { formatDate } from "../lib/format";
import type { FuelPriceCatalog, FuelPriceRecord } from "../lib/fuel-price";
import { FuelPriceForm } from "./fuel-price-form";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(value);
export function FuelPriceHistory({ catalog, authReady, writerReady, userEmail }: { catalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; userEmail: string | null }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<FuelPriceRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FuelPriceRecord | null>(null);
  const [detail, setDetail] = useState<FuelPriceRecord | null>(null);
  const [editing, setEditing] = useState<FuelPriceRecord | null>(null);
  const cancelActivation = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (pending) cancelActivation.current?.focus(); }, [pending]);
  async function activate(record: FuelPriceRecord) {
    setPending(null);
    setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Memproses aktivasi harga solar…", type: "loading", timeout: 0 });
    try {
      const outcome = await saveFuelPrice({ kind: "activate", row: record.sourceRow, date: record.effectiveDate, expectedPrice: record.rupiahPerLiter });
      toast.update(toastId, { title: outcome.ok ? "Berhasil" : outcome.message.includes("belum dapat dipastikan") || outcome.message.includes("belum pasti") ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: outcome.message, type: outcome.ok ? "success" : "error", timeout: 6000, priority: outcome.ok ? "low" : "high" });
      setMessage(outcome.message);
      if (outcome.ok) router.refresh();
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa data sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" }); setUncertain(true); setMessage("Hasil aktivasi belum pasti. Periksa tabel harga di Google Sheets sebelum mencoba lagi."); }
    finally { setSaving(false); }
  }
  async function remove(record: FuelPriceRecord) {
    setPendingDelete(null); setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Menghapus harga solar…", type: "loading", timeout: 0 });
    try {
      const outcome = await saveFuelPrice({ kind: "delete", row: record.sourceRow, date: record.effectiveDate, expectedPrice: record.rupiahPerLiter });
      toast.update(toastId, { title: outcome.ok ? "Berhasil" : "Tidak berhasil", description: outcome.message, type: outcome.ok ? "success" : "error", timeout: 6000, priority: outcome.ok ? "low" : "high" });
      setMessage(outcome.message);
      if (outcome.ok) router.refresh();
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa data sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" }); setUncertain(true); setMessage("Hasil penghapusan belum pasti. Periksa tabel harga di Google Sheets sebelum mencoba lagi."); }
    finally { setSaving(false); }
  }
  return <section className="fuel-prices" aria-labelledby="fuel-prices-title">
    <header className="fuel-prices-heading"><div><h2 id="fuel-prices-title">Harga solar</h2><p>Harga disetujui berlaku mulai tanggal yang tercatat.</p></div><Button variant="outline" onClick={() => setOpen(true)}><Plus data-icon="inline-start" aria-hidden="true" />Tambah harga</Button></header>
    {pending && <Alert><AlertTitle>Aktifkan harga solar?</AlertTitle><AlertDescription>Harga {rupiah(pending.rupiahPerLiter)} per liter berlaku mulai {formatDate(pending.effectiveDate, { day: "numeric", month: "long", year: "numeric" })}. Estimasi transaksi lama tanpa harga tersimpan dapat berubah.</AlertDescription><div className="mt-3 flex flex-wrap gap-2"><Button ref={cancelActivation} type="button" variant="outline" size="sm" onClick={() => setPending(null)}>Batal</Button><Button type="button" size="sm" onClick={() => activate(pending)}>Aktifkan harga</Button></div></Alert>}
    {pendingDelete && <Alert variant="destructive"><AlertTitle>Hapus harga solar?</AlertTitle><AlertDescription>Baris harga tanggal {formatDate(pendingDelete.effectiveDate, { day: "numeric", month: "long", year: "numeric" })} akan dikosongkan. Estimasi transaksi lama yang belum menyimpan snapshot dapat berubah; snapshot transaksi tersimpan tetap sama.</AlertDescription><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setPendingDelete(null)}>Batal</Button><Button type="button" size="sm" disabled={saving || uncertain || !writerReady || !userEmail} onClick={() => remove(pendingDelete)}>Hapus harga</Button></div></Alert>}
    {message && <p className="directory-notice" role="status">{message}</p>}
    {!catalog ? <p className="fuel-prices-empty">Harga belum dapat dibaca dari sumber.</p> : catalog.issues.length ? <p className="fuel-prices-empty">Tabel harga perlu ditinjau sebelum dapat digunakan.</p> : catalog.records.length ? <div className="fuel-prices-scroll" role="region" aria-label="Riwayat harga solar" tabIndex={0}><Table><TableHeader><TableRow><TableHead>Tanggal berlaku</TableHead><TableHead>Harga per liter</TableHead><TableHead>Status</TableHead><TableHead>Keterangan</TableHead><TableHead className="fuel-actions-heading">Aksi</TableHead></TableRow></TableHeader><TableBody>{[...catalog.records].reverse().map((record) => <TableRow key={record.sourceRow}><TableCell>{formatDate(record.effectiveDate, { day: "numeric", month: "short", year: "numeric" })}</TableCell><TableCell>{rupiah(record.rupiahPerLiter)}</TableCell><TableCell><span className={`fuel-price-status${record.active ? " is-approved" : ""}`}>{record.active ? "Aktif" : "Tidak aktif"}</span></TableCell><TableCell>{record.note || "—"}</TableCell><TableCell><div className="fuel-actions"><Button size="sm" variant="outline" onClick={() => setDetail(record)} aria-label={`Lihat detail harga tanggal ${record.effectiveDate}`}><Eye data-icon="inline-start" aria-hidden="true" />Detail</Button></div></TableCell></TableRow>)}</TableBody></Table></div> : <p className="fuel-prices-empty">Belum ada harga solar yang tercatat.</p>}
    {!writerReady ? <p className="fuel-prices-hint">Penulisan harga solar belum dikonfigurasi.</p> : !userEmail && <p className="fuel-prices-hint">Masuk melalui tombol Tambah harga untuk mengelola riwayat harga.</p>}
    {open && <FuelPriceForm catalog={catalog} authReady={authReady} writerReady={writerReady} userEmail={userEmail} onClose={() => setOpen(false)} />}
    {editing && <FuelPriceForm key={editing.sourceRow} catalog={catalog} authReady={authReady} writerReady={writerReady} userEmail={userEmail} record={editing} onClose={() => setEditing(null)} />}
    <Sheet open={detail !== null} onOpenChange={(isOpen) => { if (!isOpen) setDetail(null); }}><SheetContent><div className="p-6 space-y-6"><SheetTitle className="text-xl font-semibold">Detail harga solar</SheetTitle><SheetDescription>Harga berlaku berdasarkan tanggal yang tercatat.</SheetDescription>{detail && <dl className="space-y-4"><div><dt>Tanggal berlaku</dt><dd className="font-semibold">{formatDate(detail.effectiveDate, { day: "numeric", month: "long", year: "numeric" })}</dd></div><div><dt>Harga per liter</dt><dd className="font-semibold">{rupiah(detail.rupiahPerLiter)}</dd></div><div><dt>Status</dt><dd className="font-semibold">{detail.active ? "Aktif" : "Tidak aktif"}</dd></div><div><dt>Keterangan</dt><dd>{detail.note || "—"}</dd></div></dl>}{detail && <div className="fuel-actions fuel-detail-actions"><Button size="sm" variant="outline" className="fuel-action-edit" disabled={!writerReady || !userEmail || saving || uncertain} onClick={() => { setEditing(detail); setDetail(null); }}><Pencil data-icon="inline-start" aria-hidden="true" />Edit</Button><Button size="sm" variant="outline" className="fuel-action-archive" disabled={!writerReady || !userEmail || saving || uncertain} onClick={() => { setPendingDelete(detail); setDetail(null); }}><Trash2 data-icon="inline-start" aria-hidden="true" />Hapus</Button>{!detail.active && <Button size="sm" variant="outline" disabled={!writerReady || !userEmail || saving || uncertain} onClick={() => { setPending(detail); setDetail(null); }}>Aktifkan</Button>}<SheetClose render={<Button size="sm" variant="outline" />}><X aria-hidden="true" />Tutup</SheetClose></div>}</div></SheetContent></Sheet>
  </section>;
}
