"use client";

import { useState } from "react";
import { Toast } from "@base-ui/react/toast";
import { useRouter } from "next/navigation";
import { Switch } from "@base-ui/react/switch";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/features/dashboard/lib/format";
import { parsePlotMeasurement } from "@/features/management/lib/plot-measurement";
import { isPlot2026Date, plot2026Period, plot2026Worksheet } from "../lib/plot-sheet";
import { DraftModal, DraftPreview } from "./draft-modal";
import { savePlotActivity } from "../actions/save-plot";

type Draft = { date: string; hmStart: string; hmEnd: string; fuelPerHour: string; refill: string; status: string; notes: string };
const statusOptions = [
  { value: "Mulai pengerjaan", label: "Mulai Garap Petak" },
  { value: "Dalam pengerjaan", label: "Garap Petak Berlangsung" },
  { value: "Selesai", label: "Garap Petak Selesai" },
];

export function PlotEntryDialog({ worksheet, plotCode, previousHm, activityDisabled, writerReady, canWrite, authReady, userEmail, onClose }: { worksheet: string | null; plotCode: string; previousHm: { value: number; sourceRow: number } | null; activityDisabled: boolean; writerReady: boolean; canWrite: boolean; authReady: boolean; userEmail: string | null; onClose: () => void }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const seed: Draft = { date: "", hmStart: previousHm ? String(previousHm.value) : "", hmEnd: "", fuelPerHour: "", refill: activityDisabled ? "" : "0", status: "", notes: "" };
  const [hasFuel, setHasFuel] = useState(activityDisabled);
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed) || hasFuel !== activityDisabled;

  const annualSheet = worksheet === plot2026Worksheet;
  const outsidePeriod = annualSheet && Boolean(draft.date) && !isPlot2026Date(draft.date);

  function showPreview() {
    const problems: string[] = [];
    if (!draft.date) problems.push("Tanggal wajib diisi.");
    if (outsidePeriod) problems.push("Tanggal harus antara 1 Oktober dan 31 Desember 2026.");
    if (hasFuel && !draft.refill) problems.push("Jumlah solar wajib diisi.");
    const numbers = [["HM awal", draft.hmStart], ["HM akhir", draft.hmEnd], ["Pemakaian solar per jam", draft.fuelPerHour], ["Pengisian solar", hasFuel ? draft.refill : "0"]] as const;
    const parsed = new Map(numbers.map(([label, value]) => [label, value ? parsePlotMeasurement(value) : null]));
    for (const [label, value] of parsed) if (value && value.state !== "valid") problems.push(`${label} harus berupa angka yang valid.`);
    const refill = parsed.get("Pengisian solar");
    const fuelPerHour = parsed.get("Pemakaian solar per jam");
    if (!activityDisabled && (!draft.hmStart || !draft.hmEnd)) problems.push("HM awal dan HM akhir wajib diisi.");
    if (!activityDisabled && (!draft.fuelPerHour || fuelPerHour?.state !== "valid" || fuelPerHour.value <= 0)) problems.push("Pemakaian solar per jam wajib diisi lebih dari nol.");
    if (refill?.state === "valid" && (hasFuel ? refill.value <= 0 : refill.value !== 0)) problems.push("Jumlah pengisian solar harus lebih dari nol.");
    const start = parsed.get("HM awal")?.state === "valid" ? parsed.get("HM awal")!.value : null;
    const end = parsed.get("HM akhir")?.state === "valid" ? parsed.get("HM akhir")!.value : null;
    if (start !== null && end !== null && end < start) problems.push("HM akhir tidak boleh lebih kecil dari HM awal.");
    setErrors(problems);
    setPreview(problems.length === 0);
  }

  async function save() {
    showPreview();
    const numbers = [draft.hmStart, draft.hmEnd, draft.fuelPerHour, hasFuel ? draft.refill : "0"].map((value) => value ? parsePlotMeasurement(value) : null);
    if (!draft.date || outsidePeriod || !activityDisabled && (!draft.hmStart || !draft.hmEnd || !draft.fuelPerHour) || hasFuel && !draft.refill || numbers.some((value) => value?.state === "invalid")) return;
    const toastId = toast.add({ title: "Menyimpan catatan petak…", type: "loading", timeout: 0 });
    setSaving(true);
    try {
      const [hmStart, hmEnd, fuelPerHour] = numbers.slice(0, 3).map((value) => value?.state === "valid" ? value.value : null);
      const result = await savePlotActivity({ code: plotCode, date: draft.date, hasActivity: !activityDisabled, hasFuel, hmStart: draft.hmStart ? String(hmStart ?? "") : "", hmEnd: draft.hmEnd ? String(hmEnd ?? "") : "", fuelPerHour: draft.fuelPerHour ? String(fuelPerHour ?? "") : "", refill: hasFuel ? draft.refill : "0", status: activityDisabled ? "" : draft.status, notes: draft.notes });
      toast.update(toastId, { title: result.ok ? "Berhasil" : result.uncertain ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: result.message, type: result.ok ? "success" : "error", timeout: result.uncertain ? 0 : 6000, priority: result.ok ? "low" : "high" });
      if (result.ok) { onClose(); router.refresh(); }
    } catch {
      toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa worksheet sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" });
    } finally { setSaving(false); }
  }

  const set = (key: keyof Draft, value: string) => { setDraft({ ...draft, [key]: value }); setPreview(false); };
  const setFueling = (checked: boolean) => { setHasFuel(checked); set("refill", checked ? "" : "0"); setErrors([]); };
  const activityNumbers = [draft.hmStart, draft.hmEnd].map((value) => value ? parsePlotMeasurement(value) : null);
  const derivedHours = activityNumbers[0]?.state === "valid" && activityNumbers[1]?.state === "valid" && activityNumbers[1].value >= activityNumbers[0].value ? activityNumbers[1].value - activityNumbers[0].value : null;
  const estimatedHours = derivedHours === null ? null : Math.round(derivedHours);
  const previewNode = <DraftPreview title="Pratinjau catatan" values={[["Tanggal", draft.date], ["Kode petak", plotCode], ["HM awal", draft.hmStart], ["HM akhir", draft.hmEnd], ["HM kerja (jam)", derivedHours === null ? "Belum tersedia" : formatNumber(derivedHours)], ["Estimasi jam kerja", estimatedHours === null ? "Belum tersedia" : formatNumber(estimatedHours)], ["Pemakaian solar per jam (L/jam)", draft.fuelPerHour], ["Pengisian solar (L)", hasFuel ? draft.refill : "0"], ["Status pekerjaan", statusOptions.find(({ value }) => value === draft.status)?.label ?? draft.status], ["Keterangan", draft.notes]]} />;

  return <DraftModal className="plot-entry-dialog" wide title={activityDisabled ? "Tambah pengisian solar" : "Tambah aktivitas dan pengisian"} description={activityDisabled ? "Catat pengisian solar." : "Satu catatan aktivitas dan pengisian solar."} dirty={dirty} onClose={onClose} onReset={() => { setDraft(seed); setHasFuel(activityDisabled); setErrors([]); setPreview(false); }} onPreview={showPreview} preview={preview ? previewNode : null} onSave={save} saving={saving} hideWhileSaving saveDisabled={!writerReady || !canWrite || outsidePeriod || !draft.date || (!activityDisabled && (!draft.hmStart || !draft.hmEnd || !draft.fuelPerHour)) || (hasFuel && !draft.refill)}>
    <div className="plot-entry-identity"><span>Petak</span><strong>{plotCode}</strong></div>
    <div className="management-form-section"><h3>{activityDisabled ? "Pengisian solar" : "Aktivitas operasional"}</h3><div className="management-form-grid">
      <label><span>{activityDisabled ? "Tanggal pengisian" : "Tanggal aktivitas"} <span className="management-required" aria-hidden="true">*</span></span><Input required type="date" min={annualSheet ? plot2026Period.start : undefined} max={annualSheet ? plot2026Period.end : undefined} value={draft.date} onChange={(event) => set("date", event.target.value)} /></label>
      {!activityDisabled && <>
        <label><span>HM awal</span><Input disabled={Boolean(previousHm)} inputMode="decimal" value={draft.hmStart} onChange={(event) => set("hmStart", event.target.value)} /></label>
        <label><span>HM akhir <span className="management-required" aria-hidden="true">*</span></span><Input required inputMode="decimal" value={draft.hmEnd} onChange={(event) => set("hmEnd", event.target.value)} /></label>
        <label><span>HM kerja (jam)</span><Input className="plot-calculated-field" disabled aria-live="polite" value={derivedHours === null ? "Belum dihitung" : `${formatNumber(derivedHours)} jam`} /><span className="management-form-hint">HM akhir − HM awal</span></label>
        <label><span>Estimasi jam kerja</span><Input className="plot-calculated-field" disabled aria-live="polite" value={estimatedHours === null ? "Belum dihitung" : `${formatNumber(estimatedHours)} jam`} /><span className="management-form-hint">Pembulatan HM kerja</span></label>
        <label><span>Pemakaian solar per jam (L/jam) <span className="management-required" aria-hidden="true">*</span></span><Input required inputMode="decimal" value={draft.fuelPerHour} onChange={(event) => set("fuelPerHour", event.target.value)} placeholder="Contoh: 9,9" /><span className="management-form-hint">Masukkan nilai dari laporan operator.</span></label>
      </>}
    </div></div>
    {!activityDisabled && <div className="fuel-day-toggle"><span>Ada pengisian solar hari ini?</span><div><strong>{hasFuel ? "Ya" : "Tidak · otomatis 0 L"}</strong><Switch.Root className="fuel-day-switch" checked={hasFuel} onCheckedChange={setFueling} aria-label="Ada pengisian solar hari ini?"><Switch.Thumb className="fuel-day-switch-thumb" /></Switch.Root></div></div>}
    {(hasFuel || activityDisabled) && <label><span>Pengisian solar (L) <span className="management-required" aria-hidden="true">*</span></span><Input required inputMode="decimal" value={draft.refill} onChange={(event) => set("refill", event.target.value)} placeholder="Contoh: 125,5" aria-invalid={errors.some((error) => error.includes("Jumlah solar") || error.includes("Pengisian solar"))} /></label>}
    {!activityDisabled && <label>Status pekerjaan<select value={draft.status} onChange={(event) => set("status", event.target.value)}><option value="">Belum diketahui</option>{statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
    <label>Keterangan <span className="management-form-hint">Opsional</span><textarea rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></label>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    {(!authReady || !userEmail || !canWrite || !writerReady) && <p className="management-form-notice" role="status">{!authReady ? "Login Google belum dikonfigurasi." : !userEmail ? "Masuk dengan akun yang berizin untuk menyimpan." : !canWrite ? `Akun ${userEmail} tidak memiliki izin mencatat.` : "Penyimpanan worksheet operasional belum dikonfigurasi."}</p>}
    <p className="management-form-notice" role="status">Draft belum disimpan. Jika tidak ada pengisian, volume tercatat 0 L; pemakaian riil tetap terpisah.</p>
  </DraftModal>;
}
