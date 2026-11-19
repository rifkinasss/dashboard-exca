"use client";

import { Toast } from "@base-ui/react/toast";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraftModal } from "@/features/management/components/draft-modal";
import { saveFuelPrice } from "../actions/save-fuel-price";
import { formatFuelPriceInput, validateFuelPriceInput, type FuelPriceInput } from "../lib/fuel-price-input";
import type { FuelPriceCatalog, FuelPriceRecord } from "../lib/fuel-price";

const empty: FuelPriceInput = { date: "", price: "", active: false, note: "" };
export function FuelPriceForm({ catalog, authReady, writerReady, userEmail, onClose, record }: { catalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; userEmail: string | null; onClose: () => void; record?: FuelPriceRecord }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [draft, setDraft] = useState<FuelPriceInput>(record ? { date: record.effectiveDate, price: String(record.rupiahPerLiter), active: record.active, note: record.note } : empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const priceInput = useRef<HTMLInputElement>(null);
  const priceCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (priceCaret.current !== null && document.activeElement === priceInput.current) {
      priceInput.current?.setSelectionRange(priceCaret.current, priceCaret.current);
    }
    priceCaret.current = null;
  });
  const duplicate = Boolean(catalog?.records.some((row) => row.effectiveDate === draft.date && row.sourceRow !== record?.sourceRow));
  function update(next: Partial<FuelPriceInput>) { setDraft((current) => ({ ...current, ...next })); setErrors([]); }
  async function save() {
    const validation = validateFuelPriceInput(draft);
    const messages = validation.ok ? [] : validation.errors;
    if (duplicate) messages.push("Tanggal berlaku sudah ada.");
    setErrors(messages);
    if (messages.length) return;
    setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Memproses harga solar…", type: "loading", timeout: 0 });
    try {
      const outcome = await saveFuelPrice(record ? { kind: "edit", row: record.sourceRow, date: record.effectiveDate, expectedPrice: record.rupiahPerLiter, input: draft } : { kind: "insert", ...draft });
      toast.update(toastId, { title: outcome.ok ? "Berhasil" : outcome.message.includes("belum dapat dipastikan") || outcome.message.includes("belum pasti") ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: outcome.message, type: outcome.ok ? "success" : "error", timeout: 6000, priority: outcome.ok ? "low" : "high" });
      setMessage(outcome.message);
      if (outcome.ok) { setDraft(empty); setErrors([]); router.refresh(); onClose(); }
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa data sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" }); setUncertain(true); setMessage("Hasil penyimpanan belum pasti. Periksa tabel harga di Google Sheets sebelum mencoba lagi."); }
    finally { setSaving(false); }
  }
  return <DraftModal className="fuel-withdrawal-dialog fuel-price-dialog" title={record ? "Edit harga solar" : "Tambah harga solar"} description="Atur tanggal berlaku dan harga per liter." dirty={Object.values(draft).some(Boolean)} onClose={onClose} onReset={() => { setDraft(record ? { date: record.effectiveDate, price: String(record.rupiahPerLiter), active: record.active, note: record.note } : empty); setErrors([]); }} onSave={save} saving={saving} saveDisabled={!writerReady || !userEmail || !catalog || catalog.issues.length > 0 || uncertain}>
    <div className="management-form-grid"><label>Tanggal berlaku <span className="management-required">Wajib</span><Input disabled={saving} type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} /></label><label>Harga per liter (Rp) <span className="management-required">Wajib</span><Input ref={priceInput} disabled={saving} inputMode="decimal" value={draft.price} onChange={(event) => { const formatted = formatFuelPriceInput(event.target.value, event.target.selectionStart ?? event.target.value.length); priceCaret.current = formatted.caret; update({ price: formatted.value }); }} placeholder="Contoh: 27.500" /></label></div>
    <fieldset className="fuel-price-status-options" disabled={saving}>
      <legend>Status harga</legend>
      <p><code>true</code> = aktif, dipakai. <code>false</code> = tidak aktif.</p>
      <div>
        <label><input type="radio" name="fuel-price-status" checked={draft.active} onChange={() => update({ active: true })} /><span><strong>Aktif</strong><small>Gunakan harga ini</small></span></label>
        <label><input type="radio" name="fuel-price-status" checked={!draft.active} onChange={() => update({ active: false })} /><span><strong>Tidak aktif</strong><small>Simpan tanpa digunakan</small></span></label>
      </div>
    </fieldset>
    <p className="management-form-hint">Perubahan dapat mengubah estimasi transaksi lama.</p>
    <label>Keterangan (opsional)<textarea disabled={saving} maxLength={300} rows={2} value={draft.note} onChange={(event) => update({ note: event.target.value })} /></label>
    {errors.length > 0 && <Alert variant="destructive"><AlertDescription><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
    {(message || !authReady || !userEmail || !writerReady) && <Alert role="status"><AlertDescription>{message || (!authReady ? "Login Google belum dikonfigurasi." : !userEmail ? "Masuk dengan akun Google untuk menyimpan harga." : `Masuk sebagai ${userEmail}. Penyimpanan belum dikonfigurasi.`)}</AlertDescription></Alert>}
    {authReady && !userEmail && <Button type="button" variant="outline" onClick={() => signIn("google", { redirectTo: "/solar" })}>Masuk dengan Google</Button>}
  </DraftModal>;
}
