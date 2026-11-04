"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveFuelPrice } from "../actions/save-fuel-price";
import { formatDate } from "../lib/format";
import type { FuelPriceCatalog, FuelPriceRecord } from "../lib/fuel-price";
import { FuelPriceForm } from "./fuel-price-form";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(value);
export function FuelPriceHistory({ catalog, authReady, writerReady, userEmail }: { catalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; userEmail: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<FuelPriceRecord | null>(null);
  const cancelActivation = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (pending) cancelActivation.current?.focus(); }, [pending]);
  async function activate(record: FuelPriceRecord) {
    setPending(null);
    setSaving(true); setMessage("");
    try {
      const outcome = await saveFuelPrice({ kind: "activate", row: record.sourceRow, date: record.effectiveDate, expectedPrice: record.rupiahPerLiter });
      setMessage(outcome.message);
      if (outcome.ok) router.refresh();
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { setUncertain(true); setMessage("Hasil aktivasi belum pasti. Periksa tabel harga di Google Sheets sebelum mencoba lagi."); }
    finally { setSaving(false); }
  }
  return <section className="fuel-prices" aria-labelledby="fuel-prices-title">
    <header className="fuel-prices-heading"><div><h2 id="fuel-prices-title">Harga solar</h2><p>Harga disetujui berlaku mulai tanggal yang tercatat.</p></div><Button variant="outline" onClick={() => setOpen(true)}><Plus data-icon="inline-start" aria-hidden="true" />Tambah harga</Button></header>
    {pending && <Alert><AlertTitle>Aktifkan harga solar?</AlertTitle><AlertDescription>Harga {rupiah(pending.rupiahPerLiter)} per liter berlaku mulai {formatDate(pending.effectiveDate, { day: "numeric", month: "long", year: "numeric" })}. Estimasi transaksi lama tanpa harga tersimpan dapat berubah.</AlertDescription><div className="mt-3 flex flex-wrap gap-2"><Button ref={cancelActivation} type="button" variant="outline" size="sm" onClick={() => setPending(null)}>Batal</Button><Button type="button" size="sm" onClick={() => activate(pending)}>Aktifkan harga</Button></div></Alert>}
    {message && <p className="directory-notice" role="status">{message}</p>}
    {!catalog ? <p className="fuel-prices-empty">Harga belum dapat dibaca dari sumber.</p> : catalog.issues.length ? <p className="fuel-prices-empty">Tabel harga perlu ditinjau sebelum dapat digunakan.</p> : catalog.records.length ? <div className="fuel-prices-scroll" role="region" aria-label="Riwayat harga solar" tabIndex={0}><Table><TableHeader><TableRow><TableHead>Tanggal berlaku</TableHead><TableHead>Harga per liter</TableHead><TableHead>Status</TableHead><TableHead>Keterangan</TableHead><TableHead><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader><TableBody>{[...catalog.records].reverse().map((record) => <TableRow key={record.sourceRow}><TableCell>{formatDate(record.effectiveDate, { day: "numeric", month: "short", year: "numeric" })}</TableCell><TableCell>{rupiah(record.rupiahPerLiter)}</TableCell><TableCell><span className={`fuel-price-status${record.active ? " is-approved" : ""}`}>{record.active ? "Disetujui" : "Belum aktif"}</span></TableCell><TableCell>{record.note || "—"}</TableCell><TableCell>{!record.active && <Button size="sm" variant="outline" disabled={!writerReady || !userEmail || saving || uncertain} onClick={() => setPending(record)}>Aktifkan</Button>}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="fuel-prices-empty">Belum ada harga solar yang tercatat.</p>}
    {!writerReady ? <p className="fuel-prices-hint">Penyimpanan dan aktivasi harga belum dikonfigurasi.</p> : !userEmail && <p className="fuel-prices-hint">Masuk melalui tombol Tambah harga untuk mengaktifkan harga yang belum aktif.</p>}
    {open && <FuelPriceForm catalog={catalog} authReady={authReady} writerReady={writerReady} userEmail={userEmail} onClose={() => setOpen(false)} />}
  </section>;
}
