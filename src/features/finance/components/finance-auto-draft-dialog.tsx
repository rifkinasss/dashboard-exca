"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FuelPriceCatalog } from "@/features/dashboard/lib/fuel-price";
import type { FuelWithdrawalData } from "@/features/dashboard/lib/fuel-withdrawals";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";
import type { PlotPrice } from "@/features/management/lib/plot-price";
import type { FinanceRecord } from "../types";
import { calculateFinanceDraft, type FinanceDraftPlot } from "../lib/automatic-finance-draft";

const currency = (amount: number | null) => amount === null ? "Belum tersedia" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(amount);
const hectares = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 }).format(value);

export function FinanceAutoDraftDialog({ plots, prices, purchases, priceCatalog, records, onClose }: { plots: FinanceDraftPlot[]; prices: PlotPrice[] | null; purchases: FuelWithdrawalData | null; priceCatalog: FuelPriceCatalog | null; records: FinanceRecord[]; onClose: () => void }) {
  const [plotCode, setPlotCode] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const plot = plots.find((item) => item.code === plotCode);
  const result = plot ? calculateFinanceDraft(plot, prices, purchases, priceCatalog) : null;
  const spk = plot?.spks.length === 1 ? plot.spks[0] : null;
  const existing = plot && records.some((record) => record.plot === plot.code && record.spk === spk);
  const purchaseValue = !purchases ? "Data pembelian belum tersedia" : !result?.purchaseCount ? "Tidak ada transaksi yang cocok" : currency(result.purchaseCost);
  const values: [string, string][] = plot && result ? [
    ["Kode petak", plot.code], ["Nomor SPK", spk ?? "Belum tersedia atau lebih dari satu"],
    ["Luas petak", plot.area === null || plot.areaRequiresReview ? "Belum terverifikasi" : `${hectares(plot.area)} Ha`],
    ["Harga per hektar", result.plotPrice ? currency(result.plotPrice.pricePerHa) : "Belum terverifikasi"],
    ["Nilai petak sebelum pajak", result.plotPrice ? currency(result.plotPrice.amount) : "Belum terverifikasi"],
    ["Potongan pajak 2%", result.plotPrice ? currency(result.plotPrice.tax) : "Belum terverifikasi"],
    ["Nilai setelah pajak 2%", result.plotPrice ? currency(result.plotPrice.afterTax) : "Belum terverifikasi"],
    ["Biaya pembelian solar per petak", purchaseValue],
  ] : [];
  return <DraftModal title="Hitung data keuangan" description="Pilih petak untuk melihat perhitungan berdasarkan data yang tersedia." dirty={Boolean(plotCode)} onClose={onClose} onReset={() => { setPlotCode(""); setPreview(false); setError(""); }} onPreview={() => { if (!plot) { setError("Pilih petak terlebih dahulu."); return; } setError(""); setPreview(true); }} preview={preview ? <DraftPreview title="Pratinjau perhitungan" values={values} /> : null}>
    <Alert><AlertDescription>Perhitungan ini masih berupa pratinjau dan belum disimpan sebagai data keuangan.</AlertDescription></Alert>
    <label>Pilih petak<select value={plotCode} onChange={(event) => { setPlotCode(event.target.value); setPreview(false); setError(""); }}><option value="">Pilih kode petak</option>{plots.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    {!plots.length && <p className="management-form-hint">Data petak belum tersedia untuk perhitungan.</p>}
    {plot && result && <><section className="finance-draft-summary"><h3>Perhitungan otomatis</h3><dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      {existing && <Alert><AlertDescription>Snapshot keuangan untuk petak dan SPK ini sudah ada. Perhitungan ini tidak menambahkan atau mengubah snapshot tersebut.</AlertDescription></Alert>}
      {!result.plotPrice && <p className="management-form-hint">Nilai petak belum dapat dihitung: periksa luas, tarif, SPK, dan riwayat pekerjaan petak.</p>}
      {result.purchaseCount > 0 && <p className="management-form-hint">Pembelian berdasarkan kode petak untuk seluruh tanggal{result.incompletePurchases ? ` · ${result.pricedCount} dari ${result.purchaseCount} transaksi dihitung; total sebagian` : ""}{result.estimatedCount ? ` · ${result.estimatedCount} estimasi` : ""}. Pembelian tidak memiliki nomor SPK sehingga belum dapat dialokasikan ke SPK tertentu.</p>}
      {!!purchases?.invalidRows.length && <p className="management-form-hint">Sebagian baris pembelian tidak valid dan belum dapat dicocokkan ke petak.</p>}
    </>}
  </DraftModal>;
}
