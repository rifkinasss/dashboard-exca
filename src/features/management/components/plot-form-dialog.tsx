"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Toast } from "@base-ui/react/toast";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/features/dashboard/lib/format";
import { formatFuelPriceInput } from "@/features/dashboard/lib/fuel-price-input";
import { parseOverviewNumber } from "@/features/dashboard/lib/normalize-overview";
import { DraftModal } from "./draft-modal";
import { calculateTwoPercentTax } from "@/features/shared/tax";
import { savePlot, savePlotSpk, updatePlotMetadata } from "../actions/save-plot";

export interface PlotFormInitialValue { code: string; area: number | null; spks: string[] }
type EditTarget = {
  id: string;
  code: string;
  sheetSourceRow: number | null;
  sheetArea: number | null;
  sheetSpk: string | null;
  sheetFuelConsumption: number | null;
  operationalPricePerHa: number | null;
};
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });
const areaNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 10 });

type Draft = { code: string; area: string; spkNumber: string; pricePerHa: string };
const blank: Draft = { code: "", area: "", spkNumber: "", pricePerHa: "" };
const fromInitial = (initial: PlotFormInitialValue | null): Draft => ({ ...blank, code: initial?.code ?? "", area: initial?.area == null ? "" : String(initial.area).replace(".", ","), spkNumber: initial?.spks.length === 1 ? initial.spks[0] : "" });

export function PlotFormDialog({ initial, editing, existingPlotCodes, writerReady = false, canWrite = false, authReady = false, userEmail = null, onClose }: { initial: PlotFormInitialValue | null; editing?: EditTarget; existingPlotCodes: string[]; writerReady?: boolean; canWrite?: boolean; authReady?: boolean; userEmail?: string | null; onClose: () => void }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const seed: Draft = editing ? {
    code: editing.code, spkNumber: editing.sheetSpk ?? "",
    area: editing.sheetArea === null ? "" : String(editing.sheetArea).replace(".", ","),
    pricePerHa: editing.operationalPricePerHa?.toLocaleString("id-ID", { maximumFractionDigits: 15 }) ?? "",
  } : fromInitial(initial);
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const priceInput = useRef<HTMLInputElement>(null);
  const priceCaret = useRef<number | null>(null);
  const previewArea = parseOverviewNumber(draft.area, "id-ID");
  const previewPrice = parseOverviewNumber(draft.pricePerHa, "id-ID");
  const calculatedPreviewValue = previewPrice.state === "valid" && Number.isSafeInteger(previewPrice.value) && previewPrice.value > 0 && previewArea.state === "valid" && previewArea.value > 0 ? previewPrice.value * previewArea.value : null;
  const previewValue = calculatedPreviewValue !== null && Number.isFinite(calculatedPreviewValue) ? calculatedPreviewValue : null;
  const afterTax = calculateTwoPercentTax(previewValue)?.afterTax ?? null;
  useLayoutEffect(() => {
    if (priceCaret.current !== null && document.activeElement === priceInput.current) priceInput.current?.setSelectionRange(priceCaret.current, priceCaret.current);
    priceCaret.current = null;
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed);
  function set(key: keyof Draft, value: string) { setDraft((current) => ({ ...current, [key]: value })); }
  function reset() { setDraft(seed); setErrors([]); }
  async function savePlotData() {
    const code = draft.code.trim().replace(/\s+/g, " ");
    const spk = draft.spkNumber.trim();
    const area = parseOverviewNumber(draft.area, "id-ID");
    const price = parseOverviewNumber(draft.pricePerHa, "id-ID");
    const issues = [];
    if (!code) issues.push("Kode petak wajib diisi.");
    if (spk && !/^[\p{L}\p{N}][\p{L}\p{N} /._-]{0,79}$/u.test(spk)) issues.push("Nomor SPK tidak valid.");
    if (code.toUpperCase() !== editing?.code.toUpperCase() && existingPlotCodes.some((value) => value.trim().toLocaleUpperCase("id-ID") === code.toLocaleUpperCase("id-ID"))) issues.push("Kode petak sudah terdaftar.");
    if (area.state !== "valid" || area.value <= 0) issues.push("Luas petak wajib berupa angka lebih besar dari nol.");
    if (price.state !== "valid" || !Number.isSafeInteger(price.value) || price.value <= 0) issues.push("Harga per hektar harus berupa Rupiah bulat lebih besar dari nol.");
    setErrors(issues);
    if (issues.length || area.state !== "valid" || price.state !== "valid" || saving) return;
    setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Menyimpan petak…", type: "loading", timeout: 0 });
    try {
      const data = { spk, pricePerHa: draft.pricePerHa, area: draft.area };
      const outcome = editing
        ? await updatePlotMetadata({ ...data, code: editing.code, nextCode: code, sourceRow: editing.sheetSourceRow, previous: {
          spk: editing.sheetSpk, pricePerHa: editing.operationalPricePerHa, area: editing.sheetArea,
        } })
        : await savePlot({ ...data, code });
      const unsure = "uncertain" in outcome && Boolean(outcome.uncertain);
      toast.update(toastId, { title: outcome.ok ? "Berhasil" : unsure ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: outcome.message, type: outcome.ok ? "success" : "error", timeout: 6000, priority: outcome.ok ? "low" : "high" });
      setMessage(outcome.message);
      if (outcome.ok) {
        onClose();
        if (editing && "plotId" in outcome && typeof outcome.plotId === "string" && outcome.plotId !== editing.id) router.replace(`/petak/${outcome.plotId}`);
        else router.refresh();
      }
      else if (unsure) setUncertain(true);
    } catch {
      toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa worksheet sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" });
      setUncertain(true); setMessage("Hasil penyimpanan belum pasti. Periksa worksheet sebelum mencoba lagi.");
    } finally { setSaving(false); }
  }
  async function saveSpk() {
    const spk = draft.spkNumber.trim();
    if (!spk || !initial || initial.spks.length) return;
    const code = initial.code;
    setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Menambahkan nomor SPK…", type: "loading", timeout: 0 });
    try {
      const outcome = await savePlotSpk({ code, spk });
      toast.update(toastId, { title: outcome.ok ? "Berhasil" : outcome.uncertain ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: outcome.message, type: outcome.ok ? "success" : "error", timeout: outcome.uncertain ? 0 : 6000, priority: outcome.ok ? "low" : "high" });
      setMessage(outcome.message);
      if (outcome.ok) { router.refresh(); onClose(); }
      else if (outcome.uncertain) setUncertain(true);
    } catch {
      toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa worksheet sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" });
      setUncertain(true); setMessage("Hasil penyimpanan belum pasti. Periksa worksheet sebelum mencoba lagi.");
    } finally { setSaving(false); }
  }
  function updatePrice(value: string, caret: number) { const formatted = formatFuelPriceInput(value, caret); priceCaret.current = formatted.caret; set("pricePerHa", formatted.value); }
  if (initial) return <DraftModal className="plot-create-dialog" title="Tambahkan No. SPK" description={`Petak ${initial.code}`} dirty={dirty} onClose={onClose} onReset={reset} onSave={saveSpk} saving={saving} saveDisabled={!writerReady || !canWrite || uncertain || initial.spks.length > 0 || !draft.spkNumber.trim()}>
    <section className="management-form-section"><h3>Nomor SPK</h3>{initial.spks.length ? <><p className="management-form-hint">SPK sudah tercatat dari sumber operasional: {initial.spks.join(", ")}. Hubungan tersebut tidak diubah di sini.</p><Input aria-label="Nomor SPK yang sudah tercatat" value={draft.spkNumber} disabled /></> : <><p className="management-form-hint">Petak boleh dikerjakan sebelum SPK terbit. Nomor SPK akan ditambahkan ke blok petak ini.</p><label><span>No. SPK <span className="management-required" aria-hidden="true">*</span></span><Input autoFocus required disabled={saving} value={draft.spkNumber} onChange={(event) => set("spkNumber", event.target.value)} placeholder="Contoh: 5123120254" /></label></>}</section>
    {(message || !authReady || !userEmail || !writerReady || !canWrite) && <Alert role="status"><AlertDescription>{message || (!authReady ? "Login Google belum dikonfigurasi." : !userEmail ? "Masuk dengan akun administrator untuk menyimpan SPK." : !canWrite ? `Akun ${userEmail} tidak memiliki izin administrator.` : !writerReady ? `Masuk sebagai ${userEmail}. Penyimpanan worksheet testing belum dikonfigurasi.` : `Masuk sebagai ${userEmail}.`)}</AlertDescription></Alert>}
    {uncertain && <Alert variant="destructive"><AlertDescription>Jangan simpan ulang sebelum memeriksa nomor SPK di worksheet.</AlertDescription></Alert>}
  </DraftModal>;
  return <DraftModal className="plot-create-dialog" title={editing ? "Edit petak" : "Tambah petak lahan"} description={editing ? `Petak ${editing.code}` : "Petak baru ditambahkan sebagai blok pada worksheet operasional."} dirty={dirty}
    onClose={onClose} onReset={reset} onSave={savePlotData} saving={saving}
    saveDisabled={!writerReady || !canWrite || uncertain || Boolean(editing && (!dirty || editing.sheetSourceRow === null)) || !draft.code.trim() || !draft.area.trim() || !draft.pricePerHa.trim()}>
    <section className="management-form-section"><h3>Data petak</h3><div className="management-form-grid"><label><span>No. SPK <span className="management-form-hint">· opsional, bisa ditambahkan nanti</span></span><Input disabled={saving} value={draft.spkNumber} onChange={(event) => set("spkNumber", event.target.value)} placeholder="Isi jika sudah tersedia" /></label><label><span>Kode petak <span className="management-required" aria-hidden="true">*</span></span><Input autoFocus required disabled={saving} value={draft.code} onChange={(event) => set("code", event.target.value)} placeholder="Contoh: 82B/J54" /></label><label><span>Harga petak / Ha (Rp) <span className="management-required" aria-hidden="true">*</span></span><Input ref={priceInput} required disabled={saving} inputMode="numeric" value={draft.pricePerHa} onChange={(event) => updatePrice(event.target.value, event.target.selectionStart ?? event.target.value.length)} placeholder="1.000.000" /></label><label><span>Luas petak (Ha) <span className="management-required" aria-hidden="true">*</span></span><Input required disabled={saving} inputMode="decimal" value={draft.area} onChange={(event) => set("area", event.target.value)} placeholder="Contoh: 27" /></label></div></section>
    {editing && draft.code.trim() !== seed.code && <p className="management-form-hint">Pembelian solar yang terkait akan mengikuti kode baru.</p>}
    {editing && draft.spkNumber.trim() !== seed.spkNumber && <p className="management-form-hint">Dokumen tetap tersimpan pada nomor SPK tempat dokumen diunggah.</p>}
    <section className="plot-create-preview" aria-label="Pratinjau nilai petak"><header><strong>Pratinjau nilai petak</strong></header><table><tbody>
      <tr><th>No. SPK</th><td colSpan={2}>{draft.spkNumber.trim() || "—"}</td></tr>
      <tr><th>Kode Petak</th><td colSpan={2}>{draft.code.trim() || "—"}</td></tr>
      <tr><th>Harga Petak / Ha</th><td colSpan={2}>{previewPrice.state === "valid" && Number.isSafeInteger(previewPrice.value) && previewPrice.value > 0 ? `Rp ${formatNumber(previewPrice.value)}` : "—"}</td></tr>
      <tr><th>Total Nilai Petak</th><td colSpan={2} aria-live="polite">{previewValue === null ? "—" : currency.format(previewValue)}</td></tr>
      <tr><th>Setelah pajak 2%</th><td colSpan={2}>{afterTax === null ? "—" : currency.format(afterTax)}</td></tr>
      <tr><th>Luas Petak</th><td>{previewArea.state === "valid" && previewArea.value > 0 ? areaNumber.format(previewArea.value) : "—"}</td><td>Hektar</td></tr>
      <tr><th>Total Konsumsi Solar</th><td>{editing?.sheetFuelConsumption == null ? "—" : formatNumber(editing.sheetFuelConsumption)}</td><td>Liter</td></tr>
    </tbody></table><p>Harga diisi manual dalam Rupiah. Total nilai dihitung otomatis; konsumsi solar mengikuti aktivitas.</p></section>
    {errors.length > 0 && <Alert variant="destructive"><AlertDescription><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
    {(message || !authReady || !userEmail || !writerReady || !canWrite) && <Alert role="status"><AlertDescription>{message || (!authReady ? "Login Google belum dikonfigurasi." : !userEmail ? "Masuk dengan akun administrator untuk menyimpan petak." : !canWrite ? `Akun ${userEmail} tidak memiliki izin administrator.` : !writerReady ? `Masuk sebagai ${userEmail}. Penyimpanan worksheet testing belum dikonfigurasi.` : `Masuk sebagai ${userEmail}.`)}</AlertDescription></Alert>}
    {authReady && !userEmail && <Button type="button" variant="outline" onClick={() => signIn("google", { redirectTo: "/petak" })}>Masuk dengan Google</Button>}
    {uncertain && <Alert variant="destructive"><AlertDescription>Muat ulang halaman dan periksa data petak sebelum mencoba lagi.</AlertDescription></Alert>}
  </DraftModal>;
}