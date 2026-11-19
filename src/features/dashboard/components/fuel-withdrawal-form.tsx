"use client";

import { Toast } from "@base-ui/react/toast";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { editFuelWithdrawal, saveFuelWithdrawal } from "../actions/save-fuel-withdrawal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraftModal } from "@/features/management/components/draft-modal";
import { validateFuelWithdrawalInput, type FuelWithdrawalInput } from "../lib/fuel-withdrawal-input";
import { fuelPriceForDate, type FuelPriceCatalog } from "../lib/fuel-price";
import { formatNumber } from "../lib/format";
import type { FuelWithdrawal } from "../lib/fuel-withdrawals";

const empty: FuelWithdrawalInput = { date: "", plotCode: "", liters: "" };

export function FuelWithdrawalForm({ plotCodes, priceCatalog, authReady, writerReady, userEmail, onClose, record }: { plotCodes: string[]; priceCatalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; userEmail: string | null; onClose: () => void; record?: FuelWithdrawal }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const initial = record ? { date: record.date, plotCode: record.plotCode, liters: String(record.liters).replace(".", ",") } : empty;
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const result = validateFuelWithdrawalInput(draft);
  const sameDate = record?.date === draft.date;
  const price = sameDate ? record.price : fuelPriceForDate(priceCatalog, draft.date)?.rupiahPerLiter ?? null;
  const estimatedCost = price !== null && result.ok ? price * result.value.liters : null;
  const differentMonth = Boolean(record && draft.date && draft.date.slice(0, 7) !== record.date.slice(0, 7));
  async function save() {
    if ((!record && price === null) || (!sameDate && price === null) || !result.ok || saving || differentMonth) return;
    setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Memproses pembelian solar…", type: "loading", timeout: 0 });
    try {
      const outcome = record ? await editFuelWithdrawal({ ...draft, expectedPrice: price }, record) : await saveFuelWithdrawal({ ...draft, expectedPrice: price });
      toast.update(toastId, { title: outcome.ok ? "Berhasil" : outcome.message.includes("belum dapat dipastikan") || outcome.message.includes("belum pasti") ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: outcome.message, type: outcome.ok ? "success" : "error", timeout: 6000, priority: outcome.ok ? "low" : "high" });
      setMessage(outcome.message);
      if (outcome.ok) { onClose(); router.refresh(); }
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa data sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" }); setUncertain(true); setMessage("Hasil penyimpanan belum dapat dipastikan. Periksa Google Sheets sebelum mencoba lagi agar tidak tercatat dua kali."); }
    finally { setSaving(false); }
  }
  function update(key: keyof FuelWithdrawalInput, value: string) { setDraft((current) => ({ ...current, [key]: value })); }
  return <DraftModal className="fuel-withdrawal-dialog" title={record ? "Edit pembelian solar" : "Tambah pembelian solar"} description="Isi data pembelian solar." dirty={JSON.stringify(draft) !== JSON.stringify(initial)} onClose={onClose} onReset={() => setDraft(initial)} onSave={save} saving={saving} hideWhileSaving saveDisabled={!writerReady || !userEmail || !result.ok || differentMonth || (!sameDate && price === null) || (estimatedCost !== null && !Number.isFinite(estimatedCost)) || Boolean(record?.priceInvalid) || uncertain}>
    <div className="management-form-grid">
      <label><span>Tanggal pengambilan <span className="management-required" aria-hidden="true">*</span></span><Input required disabled={saving} type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} /></label>
      <label><span>Kode petak <span className="management-required" aria-hidden="true">*</span></span><Input required disabled={saving} value={draft.plotCode} list="withdrawal-plot-codes" onChange={(event) => update("plotCode", event.target.value)} placeholder="Pilih atau ketik kode petak" autoComplete="off" /><datalist id="withdrawal-plot-codes">{plotCodes.map((code) => <option value={code} key={code} />)}</datalist></label>
      <label><span>Jumlah solar (L) <span className="management-required" aria-hidden="true">*</span></span><Input required disabled={saving} inputMode="decimal" value={draft.liters} onChange={(event) => update("liters", event.target.value)} placeholder="Contoh: 150" /></label>
    </div>
    <div className="fuel-withdrawal-price" aria-live="polite"><span>Harga solar</span><strong>{price !== null ? `Rp ${formatNumber(price)} / L` : "Belum tersimpan"}</strong><span>Total biaya</span><strong>{estimatedCost !== null && Number.isFinite(estimatedCost) ? `Rp ${formatNumber(estimatedCost)}` : "—"}</strong><p>{differentMonth ? "Tanggal baru harus berada di bulan yang sama." : record?.priceInvalid ? "Harga transaksi perlu ditinjau sebelum diedit." : sameDate && price === null ? "Harga belum tersimpan pada transaksi ini." : !draft.date ? "Pilih tanggal untuk melihat harga yang berlaku." : price === null ? "Tidak ada harga yang disetujui untuk tanggal ini." : sameDate ? "Harga transaksi yang tersimpan tetap digunakan." : "Harga dan biaya dicatat bersama transaksi."}</p></div>
    {(message || !authReady || !userEmail || !writerReady) && <p className="management-form-notice" role="status">{message || (!authReady ? "Login Google belum dikonfigurasi. Data belum dapat disimpan." : !userEmail ? "Akun dengan izin mencatat transaksi diperlukan untuk menyimpan." : "Penyimpanan belum dikonfigurasi.")}</p>}
    {authReady && !userEmail && <Button type="button" variant="outline" onClick={() => signIn("google", { redirectTo: "/solar" })}>Masuk dengan Google</Button>}
  </DraftModal>;
}
