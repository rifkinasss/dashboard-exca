"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";
import { saveFuelPrice } from "../actions/save-fuel-price";
import { formatNumber } from "../lib/format";
import { formatFuelPriceInput, validateFuelPriceInput, type FuelPriceInput } from "../lib/fuel-price-input";
import type { FuelPriceCatalog } from "../lib/fuel-price";

const empty: FuelPriceInput = { date: "", price: "", active: false, note: "" };
export function FuelPriceForm({ catalog, authReady, writerReady, userEmail, onClose }: { catalog: FuelPriceCatalog | null; authReady: boolean; writerReady: boolean; userEmail: string | null; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
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
  const validated = validateFuelPriceInput(draft);
  const duplicate = Boolean(catalog?.records.some((row) => row.effectiveDate === draft.date));
  function update(next: Partial<FuelPriceInput>) { setDraft((current) => ({ ...current, ...next })); setPreview(false); }
  function showPreview() { const result = validateFuelPriceInput(draft); const messages = result.ok ? [] : result.errors; if (duplicate) messages.push("Tanggal berlaku sudah ada. Aktifkan harga yang tersedia atau pilih tanggal lain."); setErrors(messages); setPreview(messages.length === 0); }
  async function save() {
    setSaving(true); setMessage("");
    try {
      const outcome = await saveFuelPrice({ kind: "insert", ...draft });
      setMessage(outcome.message);
      if (outcome.ok) { setDraft(empty); setPreview(false); setErrors([]); router.refresh(); }
      else if ("uncertain" in outcome && outcome.uncertain) setUncertain(true);
    } catch { setUncertain(true); setMessage("Hasil penyimpanan belum pasti. Periksa tabel harga di Google Sheets sebelum mencoba lagi."); }
    finally { setSaving(false); }
  }
  return <DraftModal className="fuel-withdrawal-dialog fuel-price-dialog" title="Tambah harga solar" description="Atur tanggal berlaku dan harga per liter." dirty={Object.values(draft).some(Boolean)} onClose={onClose} onReset={() => { setDraft(empty); setErrors([]); setPreview(false); }} onPreview={showPreview} onSave={save} saving={saving} saveDisabled={!writerReady || !userEmail || !catalog || catalog.issues.length > 0 || !preview || !validated.ok || duplicate || uncertain} preview={preview && validated.ok ? <DraftPreview title="Pratinjau harga" values={[["Tanggal berlaku", validated.value.date], ["Harga per liter", `Rp ${formatNumber(validated.value.price)}`], ["Status", validated.value.active ? "Disetujui" : "Belum aktif"], ["Keterangan", validated.value.note]]} /> : null}>
    <div className="management-form-grid"><label>Tanggal berlaku <span className="management-required">Wajib</span><Input disabled={saving} type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} /></label><label>Harga per liter (Rp) <span className="management-required">Wajib</span><Input ref={priceInput} disabled={saving} inputMode="decimal" value={draft.price} onChange={(event) => { const formatted = formatFuelPriceInput(event.target.value, event.target.selectionStart ?? event.target.value.length); priceCaret.current = formatted.caret; update({ price: formatted.value }); }} placeholder="Contoh: 27.500" /></label></div>
    <label className="fuel-price-active"><Checkbox disabled={saving} checked={draft.active} onCheckedChange={(checked) => update({ active: checked === true })} /><span>Setujui harga untuk digunakan mulai tanggal berlaku</span></label>
    <p className="management-form-hint">Harga sebelumnya tetap digunakan untuk tanggal sebelum perubahan. Mengubah riwayat harga dapat mengubah estimasi transaksi lama yang belum menyimpan harga.</p>
    <label>Keterangan <span className="management-form-hint">Opsional</span><textarea disabled={saving} maxLength={300} rows={2} value={draft.note} onChange={(event) => update({ note: event.target.value })} /></label>
    {errors.length > 0 && <Alert variant="destructive"><AlertDescription><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
    <Alert role="status"><AlertDescription>{message || (!authReady ? "Login Google belum dikonfigurasi. Data hanya dapat dipratinjau." : !userEmail ? "Masuk dengan akun Google yang diizinkan. Login memuat ulang halaman dan menghapus draft." : !writerReady ? `Masuk sebagai ${userEmail}. Penyimpanan harga belum dikonfigurasi.` : "Tinjau data sebelum menyimpan.")}</AlertDescription></Alert>
    {authReady && !userEmail && <Button type="button" variant="outline" onClick={() => signIn("google", { redirectTo: "/solar" })}>Masuk dengan Google</Button>}
  </DraftModal>;
}
