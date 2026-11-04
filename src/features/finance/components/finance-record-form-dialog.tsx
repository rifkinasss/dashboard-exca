"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/features/dashboard/lib/format";
import { parseOverviewNumber } from "@/features/dashboard/lib/normalize-overview";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";

type Draft = { spk: string; plot: string; area: string; pricePerHa: string; pricePerPlot: string; fuelPrice: string; fuelRefill: string; fuelCost: string; gross: string; sourceNet: string };
const get = (details: [string, string][] | undefined, key: string) => details?.find(([label]) => label === key)?.[1] ?? "";

export function FinanceRecordFormDialog({ initial, plotCodes, spkNumbers, onClose }: { initial?: [string, string][]; plotCodes: string[]; spkNumbers: string[]; onClose: () => void }) {
  const seed: Draft = { spk: get(initial, "Nomor SPK"), plot: get(initial, "Kode petak"), area: get(initial, "Luas"), pricePerHa: get(initial, "Harga petak / Ha"), pricePerPlot: get(initial, "Harga per petak"), fuelPrice: get(initial, "Harga solar"), fuelRefill: get(initial, "Pengisian solar sumber"), fuelCost: get(initial, "Pengeluaran solar sumber"), gross: get(initial, "Pendapatan kotor"), sourceNet: get(initial, "Pendapatan bersih sumber") };
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed);
  function showPreview() {
    const problems: string[] = [];
    if (draft.spk && !spkNumbers.includes(draft.spk.trim())) problems.push("Nomor SPK belum ada di daftar sumber; pembuatan SPK harus melalui alur terpisah.");
    if (draft.plot && !plotCodes.includes(draft.plot)) problems.push("Pilih kode petak yang tercatat pada sumber.");
    const metrics: [string, string][] = [["Luas", draft.area], ["Harga petak / Ha", draft.pricePerHa], ["Harga per petak", draft.pricePerPlot], ["Harga solar", draft.fuelPrice], ["Pengisian solar sumber", draft.fuelRefill], ["Pengeluaran solar sumber", draft.fuelCost], ["Pendapatan kotor", draft.gross], ["Pendapatan bersih sumber", draft.sourceNet]];
    for (const [label, value] of metrics) if (value && parseOverviewNumber(value, "id-ID").state !== "valid") problems.push(`${label} harus berupa angka yang valid.`);
    setErrors(problems);
    setPreview(problems.length === 0);
  }
  const set = (key: keyof Draft, value: string) => setDraft({ ...draft, [key]: value });
  const values: [keyof Draft, string, string][] = [["area", "Luas petak (Ha)", "Ha"], ["pricePerHa", "Harga petak / Ha", "Rp"], ["pricePerPlot", "Harga per petak", "Rp"], ["fuelPrice", "Harga solar", "Rp/L"], ["fuelRefill", "Pengisian solar sumber", "L"], ["fuelCost", "Pengeluaran solar sumber", "Rp"], ["gross", "Pendapatan kotor", "Rp"], ["sourceNet", "Pendapatan bersih sumber", "Rp"]];
  const previewValues = [["Nomor SPK", draft.spk], ["Kode petak", draft.plot], ...values.map(([key, label, unit]) => { const parsed = parseOverviewNumber(draft[key], "id-ID"); return [label, parsed.state === "valid" ? `${formatNumber(parsed.value)} ${unit}` : draft[key]] as [string, string]; })] as [string, string][];
  return <DraftModal wide title={initial ? "Edit data keuangan · draft" : "Tambah data keuangan"} description="Field mengikuti kontrak Overview Finance yang tersedia saat ini." dirty={dirty} onClose={onClose} onReset={() => { setDraft(seed); setErrors([]); setPreview(false); }} onPreview={showPreview} preview={preview ? <DraftPreview title="Pratinjau snapshot keuangan" values={previewValues} /> : null}>
    <div className="management-form-section"><h3>Hubungan sumber</h3><div className="management-form-grid"><label>Nomor SPK <span className="management-form-hint">Opsional · teks</span><Input list="finance-spk-options" value={draft.spk} onChange={(event) => set("spk", event.target.value)} placeholder="Nomor SPK" /><datalist id="finance-spk-options">{spkNumbers.map((number) => <option key={number} value={number} />)}</datalist></label><label>Kode petak <span className="management-form-hint">Opsional</span><select value={draft.plot} onChange={(event) => set("plot", event.target.value)}><option value="">Belum dipasangkan</option>{plotCodes.map((code) => <option key={code}>{code}</option>)}</select></label></div></div>
    <div className="management-form-section"><h3>Nilai snapshot sumber</h3><div className="management-form-grid">{values.map(([key, label, unit]) => <label key={key}>{label}<span className="management-form-hint">Opsional · {unit}</span><Input inputMode="decimal" value={draft[key]} onChange={(event) => set(key, event.target.value)} placeholder="Belum tersedia" /></label>)}</div></div>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <p className="management-form-notice" role="status">Overview Finance tidak menyediakan tanggal transaksi. Form ini tidak menambahkan tanggal atau menghitung pendapatan, biaya, maupun laba.</p>
  </DraftModal>;
}
