"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DraftModal, DraftPreview } from "./draft-modal";

type Draft = { number: string; documentUrl: string; beritaAcaraNumber: string; beritaAcaraUrl: string; payoutNumber: string; payoutProofUrl: string; plots: string[] };
const blank: Draft = { number: "", documentUrl: "", beritaAcaraNumber: "", beritaAcaraUrl: "", payoutNumber: "", payoutProofUrl: "", plots: [] };

export function SpkFormDialog({ initialNumber = "", existingNumbers, plotOptions, onClose }: { initialNumber?: string; existingNumbers: string[]; plotOptions: string[]; onClose: () => void }) {
  const initial: Draft = { ...blank, number: initialNumber };
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  function showPreview() {
    const issues: string[] = [];
    if (!draft.number.trim()) issues.push("Nomor SPK wajib diisi.");
    if (existingNumbers.some((number) => number.trim() === draft.number.trim() && number !== initialNumber)) issues.push("Nomor SPK sudah tercatat.");
    for (const [label, value] of [["Dokumen SPK", draft.documentUrl], ["Dokumen berita acara", draft.beritaAcaraUrl], ["Bukti pencairan", draft.payoutProofUrl]] as const) if (value && !validUrl(value)) issues.push(`${label}: URL harus menggunakan HTTPS.`);
    setErrors(issues);
    setPreview(issues.length === 0);
  }
  const update = (field: keyof Draft, value: string) => setDraft({ ...draft, [field]: value });
  const stringFields: [keyof Draft, string, string][] = [["documentUrl", "Dokumen SPK URL", "https://…"], ["beritaAcaraNumber", "Nomor Berita Acara", "Opsional"], ["beritaAcaraUrl", "Dokumen Berita Acara URL", "https://…"], ["payoutNumber", "Nomor Pencairan", "Opsional"], ["payoutProofUrl", "Bukti Pencairan URL", "https://…"]];
  return <DraftModal wide title={initialNumber ? `Edit SPK ${initialNumber}` : "Tambah SPK"} description="Nomor dan dokumen administrasi SPK. Progres kerja petak dikelola terpisah." dirty={dirty} onClose={onClose} onReset={() => { setDraft(initial); setErrors([]); setPreview(false); }} onPreview={showPreview} preview={preview ? <DraftPreview title="Pratinjau administrasi SPK" values={[["Nomor SPK", draft.number], ...stringFields.map(([key, label]) => [label, String(draft[key])] as [string, string]), ["Petak terkait", draft.plots.join(", ")]]} /> : null}>
    <div className="management-form-section"><h3>Identitas SPK</h3><label>Nomor SPK <span className="management-required">Wajib</span><Input autoFocus value={draft.number} aria-invalid={errors.some((error) => error.includes("Nomor SPK"))} onChange={(event) => update("number", event.target.value)} placeholder="Nomor SPK sebagai teks" /></label></div>
    <div className="management-form-section"><h3>Dokumen administrasi</h3><div className="management-form-grid">{stringFields.map(([key, label, placeholder]) => <label key={key}>{label}<span className="management-form-hint">Opsional</span><Input type={label.endsWith("URL") ? "url" : "text"} value={String(draft[key])} aria-invalid={errors.some((error) => error.startsWith(label))} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} /></label>)}</div></div>
    <fieldset><legend>Petak terkait</legend><div className="management-plot-options">{plotOptions.length ? plotOptions.map((code) => <label className="management-radio" key={code}><input type="checkbox" checked={draft.plots.includes(code)} onChange={(event) => setDraft({ ...draft, plots: event.target.checked ? [...draft.plots, code] : draft.plots.filter((item) => item !== code) })} />{code}</label>) : <p className="management-form-hint">Belum ada petak dari data sumber.</p>}</div></fieldset>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <p className="management-form-notice" role="status">Draft lokal saja. Dokumen tidak diunggah dan perubahan belum disimpan.</p>
  </DraftModal>;
}

function validUrl(value: string) { try { return new URL(value).protocol === "https:"; } catch { return false; } }
