"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/features/dashboard/lib/format";
import { parseOverviewNumber } from "@/features/dashboard/lib/normalize-overview";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";

type Draft = { date: string; plot: string; liters: string; notes: string };
const get = (details: [string, string][] | undefined, key: string) => details?.find(([label]) => label === key)?.[1] ?? "";

export function FuelFormDialog({ initial, plotCodes, plotCode, onClose }: { initial?: [string, string][]; plotCodes: string[]; plotCode?: string; onClose: () => void }) {
  const seed: Draft = { date: get(initial, "Tanggal pengisian"), plot: get(initial, "Kode petak") || plotCode || "", liters: get(initial, "Pengisian solar"), notes: get(initial, "Keterangan") };
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed);
  function showPreview() {
    const problems: string[] = [];
    const volume = parseOverviewNumber(draft.liters, "id-ID");
    if (!draft.date) problems.push("Tanggal pengisian wajib diisi.");
    if (!draft.plot || !plotCodes.includes(draft.plot)) problems.push("Pilih kode petak dari data yang tersedia.");
    if (volume.state !== "valid" || volume.value < 0) problems.push("Jumlah solar harus berupa angka nol atau lebih.");
    setErrors(problems);
    setPreview(problems.length === 0);
  }
  const set = (key: keyof Draft, value: string) => setDraft({ ...draft, [key]: value });
  const volume = parseOverviewNumber(draft.liters, "id-ID");
  return <DraftModal title={initial ? "Edit pengisian · draft" : "Tambah pengisian solar"} description="Catatan pengisian adalah transaksi terpisah dari pemakaian solar riil." dirty={dirty} onClose={onClose} onReset={() => { setDraft(seed); setErrors([]); setPreview(false); }} onPreview={showPreview} preview={preview ? <DraftPreview title="Pratinjau pengisian" values={[["Tanggal pengisian", draft.date], ["Kode petak", draft.plot], ["Jumlah solar", volume.state === "valid" ? `${formatNumber(volume.value)} L` : draft.liters], ["Keterangan", draft.notes]]} /> : null}>
    <div className="management-form-section"><h3>Transaksi pengisian</h3><div className="management-form-grid"><label>Tanggal pengisian <span className="management-required">Wajib</span><Input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} /></label><label>Kode petak <span className="management-required">Wajib</span><select value={draft.plot} onChange={(event) => set("plot", event.target.value)}><option value="">Pilih petak</option>{plotCodes.map((code) => <option key={code}>{code}</option>)}</select></label><label>Jumlah solar (L) <span className="management-required">Wajib</span><Input inputMode="decimal" value={draft.liters} onChange={(event) => set("liters", event.target.value)} placeholder="Contoh: 125,5" aria-invalid={errors.some((error) => error.includes("Jumlah solar"))} /></label></div></div>
    <label>Keterangan <span className="management-form-hint">Opsional</span><textarea rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></label>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <p className="management-form-notice" role="status">Tanggal dan volume adalah draft. Pengisian tidak dianggap sama dengan konsumsi solar riil.</p>
  </DraftModal>;
}
