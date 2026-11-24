"use client";

import { useState } from "react";
import { Toast } from "@base-ui/react/toast";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { DraftModal, DraftPreview } from "@/features/management/components/draft-modal";
import { updatePlotActivity } from "@/features/management/actions/save-plot";
import { activityEditDraft, planActivityEdit, type ActivityEditDraft, type PlotActivity } from "@/features/management/lib/plot-activity-edit";

const statusOptions = [
  { value: "Mulai pengerjaan", label: "Mulai Garap Petak" },
  { value: "Dalam pengerjaan", label: "Garap Petak Berlangsung" },
  { value: "Selesai", label: "Garap Petak Selesai" },
];
const measurements = [
  ["hmStart", "HM awal"], ["hmEnd", "HM akhir"], ["workingHours", "HM kerja (jam)"],
  ["estimatedWorkingHours", "Estimasi jam kerja"], ["fuelRefill", "Pengisian solar (L)"],
  ["fuelPerHour", "Pemakaian solar (L/jam)"],
] as const;

export function ActivityFormDialog({ activity, plotCode, worksheet, onClose }: {
  activity: PlotActivity;
  plotCode: string;
  worksheet: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const seed = activityEditDraft(activity);
  const [draft, setDraft] = useState(seed);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed);

  function validate() {
    const plan = planActivityEdit(activity, draft, worksheet ?? "");
    setError(plan.error ?? "");
    return Boolean(plan.cells);
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const result = await updatePlotActivity({ code: plotCode, sourceRow: activity.sourceRow, snapshot: JSON.stringify(activity), draft });
      if (!result.ok) {
        setError(result.message);
        setUncertain(Boolean(result.uncertain));
        return;
      }
      toast.add({ title: result.message, type: "success" });
      onClose();
      router.refresh();
    } catch {
      setError("Hasil belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.");
      setUncertain(true);
    } finally {
      setSaving(false);
    }
  }

  function set(key: keyof ActivityEditDraft, value: string) {
    setDraft({ ...draft, [key]: value });
    setPreview(false);
    if (!uncertain) setError("");
  }

  return <DraftModal wide title="Edit aktivitas" description={`Petak ${plotCode}`} dirty={dirty}
    onClose={onClose} onReset={() => { setDraft(seed); if (!uncertain) setError(""); setPreview(false); }}
    onSave={save} saveDisabled={!dirty || uncertain} saving={saving}
    onPreview={() => setPreview(validate())}
    preview={preview ? <DraftPreview title="Pratinjau aktivitas" values={[
      ["Tanggal aktivitas", draft.date],
      ...measurements.map(([key, label]): [string, string] => [label, draft[key]]),
      ["Status pekerjaan", statusOptions.find(({ value }) => value === draft.workStatus)?.label ?? draft.workStatus],
      ["Keterangan", draft.notes],
    ]} /> : null}>
    <fieldset className="management-form-section" disabled={saving || uncertain}>
      <div className="management-form-grid">
        <label>Tanggal aktivitas<Input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} /></label>
        {measurements.map(([key, label]) => <label key={key}>{label}<Input inputMode="decimal" value={draft[key]} onChange={(event) => set(key, event.target.value)} /></label>)}
      </div>
      <p className="management-form-hint">Kosongkan HM kerja atau estimasi untuk memakai rumus worksheet.</p>
      <label>Status pekerjaan<select value={draft.workStatus} onChange={(event) => set("workStatus", event.target.value)}>
        <option value="">Belum diketahui</option>
        {draft.workStatus && !statusOptions.some(({ value }) => value === draft.workStatus) && <option value={draft.workStatus} disabled>{draft.workStatus}</option>}
        {statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Keterangan<textarea rows={3} maxLength={1000} value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></label>
    </fieldset>
    {error && <p className="management-form-errors" role="alert">{error}</p>}
  </DraftModal>;
}
