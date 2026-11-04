"use client";

import { useMemo, useState } from "react";
import { Info, Plus, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FuelPriceCatalog } from "../lib/fuel-price";
import type { FuelWithdrawalData } from "../lib/fuel-withdrawals";
import { FuelWithdrawalDataTable } from "./fuel-withdrawal-data-table";
import { FuelPriceHistory } from "./fuel-price-history";
import { FuelWithdrawalForm } from "./fuel-withdrawal-form";

export function FuelWithdrawalDirectory({ data, priceCatalog, authReady, writerReady, priceWriterReady, userEmail }: { data: FuelWithdrawalData; priceCatalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; priceWriterReady: boolean; userEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(1);
  const invalidRange = Boolean(start && end && start > end);
  const filtered = useMemo(() => data.records.filter((row) => !invalidRange && row.plotCode.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")) && (!start || row.date >= start) && (!end || row.date <= end)).sort((a, b) => b.date.localeCompare(a.date) || b.sourceRow - a.sourceRow), [data.records, query, start, end, invalidRange]);
  const plotCodes = [...new Set(data.records.map((row) => row.plotCode))].sort();
  const hasFilters = Boolean(query || start || end);
  function resetFilters() { setQuery(""); setStart(""); setEnd(""); setPage(1); }

  return <main className="directory-page fuel-directory">
    <header className="fuel-directory-heading">
      <div><p className="fuel-directory-eyebrow">Manajemen data</p><h1>Pembelian Solar</h1><p>Catatan pengambilan solar berdasarkan tanggal dan kode petak.</p></div>
      <Button className="fuel-add-button" onClick={() => setOpen(true)}><Plus data-icon="inline-start" aria-hidden="true" />Tambah pembelian</Button>
    </header>

    <FuelPriceHistory catalog={priceCatalog} authReady={authReady} writerReady={priceWriterReady} userEmail={userEmail} />

    <section className="fuel-filter-panel" aria-label="Cari dan filter pembelian solar">
      <div className="fuel-filter-heading"><div><h2>Daftar pembelian</h2><p>Cari dan saring transaksi berdasarkan periode.</p></div><span aria-live="polite">{filtered.length} dari {data.records.length} transaksi</span></div>
      <div className="fuel-filter-fields">
        <label className="fuel-filter-search"><span>Kode petak</span><div><Search size={17} aria-hidden="true" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari kode petak" /></div></label>
        <label className="fuel-filter-field"><span>Tanggal awal</span><Input type="date" value={start} aria-invalid={invalidRange} onChange={(event) => { setStart(event.target.value); setPage(1); }} /></label>
        <label className="fuel-filter-field"><span>Tanggal akhir</span><Input type="date" value={end} aria-invalid={invalidRange} onChange={(event) => { setEnd(event.target.value); setPage(1); }} /></label>
        <Button className="fuel-filter-reset" variant="outline" disabled={!hasFilters} onClick={resetFilters}><RotateCcw data-icon="inline-start" aria-hidden="true" />Reset</Button>
      </div>
      {invalidRange && <p className="field-error" role="alert">Tanggal akhir harus sama atau setelah tanggal awal.</p>}
    </section>

    <div className="fuel-price-note"><Info size={16} aria-hidden="true" /><p>Transaksi baru menyimpan harga dan biaya saat dicatat. Baris lama tanpa harga tersimpan memakai estimasi berdasarkan master saat ini; nilai ini bukan bukti pembayaran.</p></div>
    {(!priceCatalog || priceCatalog.issues.length > 0) && <p className="directory-notice" role="status">Harga solar belum dapat digunakan. Periksa tabel harga di worksheet Pengambilan Solar{priceCatalog?.issues.length ? `: ${priceCatalog.issues.join(" ")}` : "."}</p>}
    {data.invalidRows.length > 0 && <p className="directory-notice" role="status">{data.invalidRows.length} transaksi tidak valid dan belum dapat ditampilkan.</p>}

    <FuelWithdrawalDataTable rows={filtered} total={data.records.length} page={page} setPage={setPage} priceCatalog={priceCatalog} hasFilters={hasFilters} resetFilters={resetFilters} />
    {open && <FuelWithdrawalForm plotCodes={plotCodes} priceCatalog={priceCatalog} authReady={authReady} writerReady={writerReady} userEmail={userEmail} onClose={() => setOpen(false)} />}
  </main>;
}
