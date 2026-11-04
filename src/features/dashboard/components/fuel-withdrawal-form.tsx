"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { saveFuelWithdrawal } from "../actions/save-fuel-withdrawal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";
import { validateFuelWithdrawalInput, type FuelWithdrawalInput } from "../lib/fuel-withdrawal-input";
import { fuelPriceForDate, type FuelPriceCatalog } from "../lib/fuel-price";
import { formatNumber } from "../lib/format";

const empty: FuelWithdrawalInput = { date: "", plotCode: "", liters: "" };

export function FuelWithdrawalForm({ plotCodes, priceCatalog, authReady, writerReady, userEmail, onClose }: { plotCodes: string[]; priceCatalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; userEmail: string | null; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const result = validateFuelWithdrawalInput(draft);
  const price = fuelPriceForDate(priceCatalog, draft.date);
  const estimatedCost = price && result.ok ? price.rupiahPerLiter * result.value.liters : null;
  async function save() {
    if (!price) return;
    setSaving(true); setMessage("");
    try {
      const outcome = await saveFuelWithdrawal({ ...draft, expectedPrice: price.rupiahPerLiter });
      setMessage(outcome.message);
      if (outcome.ok) { setDraft(empty); setPreview(false); setErrors([]); router.refresh(); }
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { setUncertain(true); setMessage("Hasil penyimpanan belum dapat dipastikan. Periksa Google Sheets sebelum mencoba lagi agar tidak tercatat dua kali."); }
    finally { setSaving(false); }
  }
  function update(key: keyof FuelWithdrawalInput, value: string) { setDraft((current) => ({ ...current, [key]: value })); setPreview(false); }
  function showPreview() { const checked = validateFuelWithdrawalInput(draft); setErrors(checked.ok ? [] : checked.errors); setPreview(checked.ok); }
  return <DraftModal className="fuel-withdrawal-dialog" title="Tambah pembelian solar" description="Tinjau data pengambilan sebelum menyimpan." dirty={Object.values(draft).some(Boolean)} onClose={onClose} onReset={() => { setDraft(empty); setErrors([]); setPreview(false); }} onPreview={showPreview} onSave={save} saving={saving} saveDisabled={!writerReady || !userEmail || !preview || !result.ok || !price || estimatedCost === null || !Number.isFinite(estimatedCost) || uncertain} preview={preview && result.ok ? <DraftPreview title="Pratinjau pembelian" values={[["Tanggal", result.value.date], ["Kode petak", result.value.plotCode], ["Jumlah solar", `${formatNumber(result.value.liters)} L`], ["Harga solar", price ? `Rp ${formatNumber(price.rupiahPerLiter)} / L` : "Belum tersedia"], ["Biaya solar", estimatedCost !== null && Number.isFinite(estimatedCost) ? `Rp ${formatNumber(estimatedCost)}` : "Belum tersedia"]]} /> : null}>
    <div className="management-form-grid">
      <label>Tanggal pengambilan <span className="management-required">Wajib</span><Input disabled={saving} type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} /></label>
      <label>Kode petak <span className="management-required">Wajib</span><Input disabled={saving} value={draft.plotCode} list="withdrawal-plot-codes" onChange={(event) => update("plotCode", event.target.value)} autoComplete="off" /><datalist id="withdrawal-plot-codes">{plotCodes.map((code) => <option value={code} key={code} />)}</datalist></label>
      <label>Jumlah solar (L) <span className="management-required">Wajib</span><Input disabled={saving} inputMode="decimal" value={draft.liters} onChange={(event) => update("liters", event.target.value)} placeholder="Contoh: 150" /></label>
    </div>
    <p className="management-form-hint">{price ? `Harga berlaku: Rp ${formatNumber(price.rupiahPerLiter)} / L${estimatedCost !== null && Number.isFinite(estimatedCost) ? ` · Estimasi biaya: Rp ${formatNumber(estimatedCost)}` : ""}.` : "Harga aktif belum tersedia untuk tanggal ini."} Harga dan biaya akan disimpan saat transaksi dicatat; bukan bukti pembayaran.</p>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <p className="management-form-notice" role="status">{message || (!authReady ? "Login Google belum dikonfigurasi. Data hanya dapat dipratinjau." : !userEmail ? "Masuk dengan akun Google yang diizinkan untuk melanjutkan. Login memuat ulang halaman dan menghapus draft." : !writerReady ? `Masuk sebagai ${userEmail}. Penyimpanan belum dikonfigurasi.` : `Masuk sebagai ${userEmail}. Tinjau data sebelum menyimpan.`)}</p>
    {authReady && !userEmail && <Button type="button" variant="outline" onClick={() => signIn("google", { redirectTo: "/solar" })}>Masuk dengan Google</Button>}
  </DraftModal>;
}
