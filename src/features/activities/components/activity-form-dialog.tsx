"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { parseOverviewNumber } from "@/features/dashboard/lib/normalize-overview";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";

type Draft = { date: string; plot: string; hmStart: string; hmEnd: string; hours: string; estimate: string; refill: string; status: string; notes: string };
const get = (details: [string, string][] | undefined, key: string) => details?.find(([label]) => label === key)?.[1] ?? "";
const fromDetails = (details?: [string, string][], plotCode = ""): Draft => ({ date: get(details, "Tanggal aktivitas"), plot: get(details, "Kode petak") || plotCode, hmStart: get(details, "HM awal"), hmEnd: get(details, "HM akhir"), hours: get(details, "HM kerja"), estimate: get(details, "Estimasi jam kerja"), refill: get(details, "Pengisian solar"), status: get(details, "Status pekerjaan"), notes: get(details, "Keterangan") });
const statusOptions = [
  { value: "Mulai pengerjaan", label: "Mulai Garap Petak" },
  { value: "Dalam pengerjaan", label: "Garap Petak Berlangsung" },
  { value: "Selesai", label: "Garap Petak Selesai" },
];

export function ActivityFormDialog({ initial, plotCodes, plotCode, onClose }: { initial?: [string, string][]; plotCodes: string[]; plotCode?: string; onClose: () => void }) {
  const seed = fromDetails(initial, plotCode);
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed);
  function showPreview() {
    const problems: string[] = [];
    if (!draft.date) problems.push("Tanggal aktivitas wajib diisi.");
    if (!draft.plot || !plotCodes.includes(draft.plot)) problems.push("Pilih kode petak dari data yang tersedia.");
    const numbers = [["HM awal", draft.hmStart], ["HM akhir", draft.hmEnd], ["HM kerja", draft.hours], ["Estimasi jam kerja", draft.estimate], ["Pengisian solar", draft.refill]] as const;
    const parsed = new Map(numbers.map(([label, value]) => [label, value ? parseOverviewNumber(value, "id-ID") : null]));
    for (const [label, value] of parsed) if (value && value.state !== "valid") problems.push(`${label} harus berupa angka yang valid.`);
    const refill = parsed.get("Pengisian solar");
    if (refill?.state === "valid" && refill.value < 0) problems.push("Pengisian solar tidak boleh negatif.");
    const start = parsed.get("HM awal")?.state === "valid" ? parsed.get("HM awal")!.value : null;
    const end = parsed.get("HM akhir")?.state === "valid" ? parsed.get("HM akhir")!.value : null;
    const hours = parsed.get("HM kerja")?.state === "valid" ? parsed.get("HM kerja")!.value : null;
    if (start !== null && end !== null && end < start) problems.push("HM akhir tidak boleh lebih kecil dari HM awal.");
    if (start !== null && end !== null && end >= start && hours !== null && Math.abs((end - start) - hours) > 1e-6) problems.push("HM kerja harus sesuai selisih HM akhir dan HM awal; nilai tidak dikoreksi otomatis.");
    setErrors(problems);
    setPreview(problems.length === 0);
  }
  const set = (key: keyof Draft, value: string) => { setDraft({ ...draft, [key]: value }); setPreview(false); };
  const field = (key: keyof Draft, label: string) => <label>{label}<span className="management-form-hint">Opsional</span><Input inputMode="decimal" value={draft[key]} onChange={(event) => set(key, event.target.value)} /></label>;
  const parsedStart = draft.hmStart ? parseOverviewNumber(draft.hmStart, "id-ID") : null;
  const parsedEnd = draft.hmEnd ? parseOverviewNumber(draft.hmEnd, "id-ID") : null;
  const derivedHours = parsedStart?.state === "valid" && parsedEnd?.state === "valid" && parsedEnd.value >= parsedStart.value ? parsedEnd.value - parsedStart.value : null;
  const previewHours = draft.hours || (derivedHours === null ? "Belum tersedia" : String(derivedHours));
  return <DraftModal wide title={initial ? "Edit aktivitas" : "Tambah aktivitas"} description="Satu aktivitas menyimpan riwayat HM dan status untuk satu petak." dirty={dirty} onClose={onClose} onReset={() => { setDraft(seed); setErrors([]); setPreview(false); }} onPreview={showPreview} preview={preview ? <DraftPreview title="Pratinjau aktivitas" values={[["Tanggal aktivitas", draft.date], ["Kode petak", draft.plot], ["HM awal", draft.hmStart], ["HM akhir", draft.hmEnd], ["HM kerja", previewHours], ["Estimasi jam kerja", draft.estimate], ["Pengisian solar (L)", draft.refill], ["Status pekerjaan", statusOptions.find(({ value }) => value === draft.status)?.label ?? draft.status], ["Keterangan", draft.notes]]} /> : null}>
    <div className="management-form-section"><h3>Aktivitas</h3><div className="management-form-grid"><label>Tanggal aktivitas <span className="management-required">Wajib</span><Input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} /></label><label>Kode petak <span className="management-required">Wajib</span><select value={draft.plot} onChange={(event) => set("plot", event.target.value)}><option value="">Pilih petak</option>{plotCodes.map((code) => <option key={code}>{code}</option>)}</select></label>{field("hmStart", "HM awal")}{field("hmEnd", "HM akhir")}{field("hours", "HM kerja (jam)")}{field("estimate", "Estimasi jam kerja")}{field("refill", "Pengisian solar (L)")}</div><p className="management-form-hint">Jika HM kerja kosong, pratinjau memakai selisih HM awal dan akhir. Nilai HM yang diisi harus cocok; tidak ada pengukuran yang ditimpa otomatis.</p></div>
    <label>Status pekerjaan<select value={draft.status} onChange={(event) => set("status", event.target.value)}><option value="">Belum diketahui</option>{draft.status && !statusOptions.some(({ value }) => value === draft.status) && <option value={draft.status} disabled>{draft.status} · nilai sumber</option>}{statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Keterangan <span className="management-form-hint">Opsional</span><textarea rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></label>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <p className="management-form-notice" role="status">Pengisian solar dicatat terpisah dari pemakaian riil. Data aktivitas ini masih berupa draft dan belum disimpan.</p>
  </DraftModal>;
}
