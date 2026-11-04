"use client";

import { useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/features/dashboard/lib/format";
import { parseOverviewNumber } from "@/features/dashboard/lib/normalize-overview";
import { monitorConsumption } from "../lib/plot-workflow-input";
import { DraftModal, DraftPreview } from "./draft-modal";

export interface PlotFormInitialValue { code: string; area: number | null; spks: string[] }
type Draft = { code: string; area: string; spkNumber: string; activityDate: string; hmStart: string; hmEnd: string; hours: string; estimate: string; refill: string; status: string; notes: string; monitorStart: string; monitorEnd: string; startDate: string; endDate: string; beritaNumber: string; disbursementNumber: string };
type FileKey = "spk" | "berita" | "disbursement" | "startPhoto" | "endPhoto";
const blank: Draft = { code: "", area: "", spkNumber: "", activityDate: "", hmStart: "", hmEnd: "", hours: "", estimate: "", refill: "", status: "", notes: "", monitorStart: "", monitorEnd: "", startDate: "", endDate: "", beritaNumber: "", disbursementNumber: "" };
const fromInitial = (initial: PlotFormInitialValue | null): Draft => ({ ...blank, code: initial?.code ?? "", area: initial?.area == null ? "" : String(initial.area).replace(".", ","), spkNumber: initial?.spks.length === 1 ? initial.spks[0] : "" });

export function PlotFormDialog({ initial, initialDocument, existingPlotCodes, existingSpkNumbers, onClose }: { initial: PlotFormInitialValue | null; initialDocument?: "spk" | "berita" | "disbursement"; existingPlotCodes: string[]; existingSpkNumbers: string[]; onClose: () => void }) {
  const seed = fromInitial(initial);
  const [draft, setDraft] = useState(seed);
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<FileKey, string>>>({});
  const [dragging, setDragging] = useState<FileKey | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const consumption = monitorConsumption(draft.monitorStart, draft.monitorEnd);
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed) || Object.keys(files).length > 0;
  function set(key: keyof Draft, value: string) { setDraft((current) => ({ ...current, [key]: value })); setPreview(false); }
  function pick(key: FileKey, file?: File) {
    const isImage = file?.type.startsWith("image/");
    const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
    const photoOnly = key === "startPhoto" || key === "endPhoto";
    if (file && !isImage && (photoOnly || !isPdf)) { setFileErrors((current) => ({ ...current, [key]: photoOnly ? "Pilih file gambar." : "Pilih file PDF atau gambar." })); return; }
    setFileErrors((current) => ({ ...current, [key]: undefined }));
    setFiles((current) => { const next = { ...current }; if (file) next[key] = file; else delete next[key]; return next; }); setPreview(false);
  }
  function reset() { setDraft(seed); setFiles({}); setFileErrors({}); setFileKey((value) => value + 1); setErrors([]); setPreview(false); }
  function showPreview() {
    const issues: string[] = [];
    if (!draft.code.trim()) issues.push("Kode petak wajib diisi.");
    if (existingPlotCodes.some((code) => code.trim().toLocaleUpperCase("id-ID") === draft.code.trim().toLocaleUpperCase("id-ID") && code !== initial?.code)) issues.push("Kode petak sudah terdaftar.");
    const fields = [["Luas petak", draft.area], ["HM awal", draft.hmStart], ["HM akhir", draft.hmEnd], ["HM kerja", draft.hours], ["Estimasi jam kerja", draft.estimate], ["Pengisian solar", draft.refill]] as const;
    for (const [label, value] of fields) if (value.trim()) { const number = parseOverviewNumber(value, "id-ID"); if (number.state !== "valid" || number.value < 0 || (label === "Luas petak" && number.value === 0)) issues.push(`${label} harus berupa angka yang valid${label === "Luas petak" ? " dan lebih besar dari nol" : " dan tidak negatif"}.`); }
    const activity = [draft.hmStart, draft.hmEnd, draft.hours, draft.estimate, draft.refill, draft.status, draft.notes].some((value) => value.trim());
    if (activity && !draft.activityDate) issues.push("Tanggal aktivitas wajib diisi jika aktivitas ditambahkan.");
    const hmStart = parseOverviewNumber(draft.hmStart, "id-ID"), hmEnd = parseOverviewNumber(draft.hmEnd, "id-ID"), hours = parseOverviewNumber(draft.hours, "id-ID");
    if (hmStart.state === "valid" && hmEnd.state === "valid") {
      if (hmEnd.value < hmStart.value) issues.push("HM akhir tidak boleh lebih kecil dari HM awal.");
      else if (hours.state === "valid" && Math.abs(hmEnd.value - hmStart.value - hours.value) > 1e-6) issues.push("HM kerja harus sesuai selisih HM akhir dan HM awal.");
    }
    if (consumption.error) issues.push(consumption.error);
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) issues.push("Tanggal monitor akhir tidak boleh sebelum tanggal awal.");
    setErrors(issues); setPreview(issues.length === 0);
  }
  const field = (key: keyof Draft, label: string, type = "text") => <label>{label}<Input type={type} inputMode={type === "text" && ["area", "hmStart", "hmEnd", "hours", "estimate", "refill", "monitorStart", "monitorEnd"].includes(key) ? "decimal" : undefined} value={draft[key]} onChange={(event) => set(key, event.target.value)} /></label>;
  const upload = (key: FileKey, label: string, accept: string) => <div className="plot-upload"><label className={`plot-upload-drop${dragging === key ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(key); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(null); }} onDrop={(event) => { event.preventDefault(); setDragging(null); if (event.dataTransfer.files.length !== 1) { setFileErrors((current) => ({ ...current, [key]: "Pilih satu file." })); return; } pick(key, event.dataTransfer.files[0]); }}><Input className="sr-only" key={`${key}-${fileKey}`} autoFocus={initialDocument === key} type="file" accept={accept} onChange={(event) => { if (event.target.files?.[0]) pick(key, event.target.files[0]); event.target.value = ""; }} />{files[key] ? <FileCheck2 aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}<span className="plot-upload-title">{label}</span><span className="plot-upload-action">{files[key] ? "Ganti file" : "Pilih file atau seret ke sini"}</span><span className="plot-upload-hint">{files[key]?.name ?? (accept === "image/*" ? "Gambar" : "PDF atau gambar")}</span></label>{fileErrors[key] && <p className="plot-upload-error" role="alert">{fileErrors[key]}</p>}</div>;
  return <DraftModal wide title={initial ? "Kelola petak lahan" : "Tambah petak lahan"} description="Isi data yang tersedia sekarang; bagian lain dapat dilengkapi nanti." dirty={dirty} onClose={onClose} onReset={reset} onPreview={showPreview} preview={preview ? <DraftPreview title="Pratinjau petak" values={[["Kode petak", draft.code], ["Luas petak", draft.area ? `${draft.area} Ha` : "Belum diisi"], ["Nomor SPK", draft.spkNumber || "Belum tersedia"], ["Tanggal aktivitas", draft.activityDate], ["Status pekerjaan", draft.status], ["Konsumsi monitor", consumption.value === null ? "Belum tersedia" : `${formatNumber(consumption.value)} L`], ["Dokumen dipilih", Object.values(files).map((file) => file.name).join(", ") || "Belum ada"]]} /> : null}>
    <Alert><AlertDescription>Form ini masih pratinjau. Data dan file belum disimpan ke Google Sheets atau Google Drive.</AlertDescription></Alert>
    <section className="management-form-section"><h3>Data petak</h3><div className="management-form-grid"><label><span>Kode petak <span className="management-required" aria-hidden="true">*</span></span><Input autoFocus={!initialDocument} required value={draft.code} onChange={(event) => set("code", event.target.value)} placeholder="Contoh: 72A1/J54" /></label>{field("area", "Luas petak (Ha) · opsional")}</div></section>
    <details className="plot-workflow-section" open={initialDocument === "spk" || undefined}><summary>SPK & dokumen <span>Opsional</span></summary><div className="management-form-grid">{field("spkNumber", "Nomor SPK")}{upload("spk", "Dokumen SPK", ".pdf,image/*")}</div>{initial && initial.spks.length > 1 && <p className="management-form-hint">Petak memiliki beberapa SPK: {initial.spks.join(", ")}. Hubungan ini tidak diubah oleh draft.</p>}{draft.spkNumber && existingSpkNumbers.includes(draft.spkNumber.trim()) && <p className="management-form-hint">Nomor ini sudah tercatat pada sumber.</p>}</details>
    <details className="plot-workflow-section"><summary>Aktivitas operasional <span>Opsional</span></summary><p className="management-form-hint">Satu catatan aktivitas untuk petak ini. Tanggal wajib diisi jika ada data aktivitas.</p><div className="management-form-grid">{field("activityDate", "Tanggal aktivitas", "date")}{field("hmStart", "HM awal")}{field("hmEnd", "HM akhir")}{field("hours", "HM kerja (jam)")}{field("estimate", "Estimasi jam kerja")}{field("refill", "Pengisian solar (L)")}<label>Status pekerjaan<select value={draft.status} onChange={(event) => set("status", event.target.value)}><option value="">Belum diketahui</option><option value="Mulai pengerjaan">Mulai Garap Petak</option><option value="Dalam pengerjaan">Garap Petak Berlangsung</option><option value="Selesai">Garap Petak Selesai</option></select></label><label>Keterangan<textarea rows={2} value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></label></div></details>
    <details className="plot-workflow-section"><summary>Monitor konsumsi solar <span>Opsional</span></summary><p className="management-form-hint">Angka kumulatif dalam liter. Konsumsi dihitung dari monitor akhir dikurangi awal.</p><div className="management-form-grid">{field("startDate", "Tanggal monitor awal", "date")}{field("monitorStart", "Angka monitor awal (L)")}{upload("startPhoto", "Foto monitor awal", "image/*")}{field("endDate", "Tanggal monitor akhir", "date")}{field("monitorEnd", "Angka monitor akhir (L)")}{upload("endPhoto", "Foto monitor akhir", "image/*")}</div><p className="management-form-hint">{consumption.error ?? (consumption.value === null ? "Isi kedua angka untuk menghitung konsumsi." : `Selisih monitor: ${formatNumber(consumption.value)} L`)}</p></details>
    <details className="plot-workflow-section" open={initialDocument === "berita" || initialDocument === "disbursement" || undefined}><summary>Berita Acara & pencairan <span>Opsional</span></summary><div className="management-form-grid">{field("beritaNumber", "Nomor Berita Acara")}{upload("berita", "Dokumen Berita Acara", ".pdf,image/*")}{field("disbursementNumber", "Nomor pencairan")}{upload("disbursement", "Bukti pencairan", ".pdf,image/*")}</div></details>
    {errors.length > 0 && <Alert variant="destructive"><AlertDescription><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
  </DraftModal>;
}
