"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function PlotActionDialog({ title, description, actionLabel, destructive = false, onConfirm, onClose }: {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<{ ok: boolean; message: string; uncertain?: boolean }>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const result = await onConfirm();
      if (!result.ok) {
        setError(result.message);
        setUncertain(Boolean(result.uncertain));
      }
    } catch {
      setError("Hasil belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.");
      setUncertain(true);
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} className="management-form-dialog plot-action-dialog" aria-labelledby="plot-action-title" aria-describedby="plot-action-description"
    onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="management-form">
      <header><div><h2 id="plot-action-title">{title}</h2><p id="plot-action-description">{description}</p></div></header>
      {error && <div className="management-form-content"><p className="management-form-errors" role="alert">{error}</p></div>}
      <footer>
        <Button autoFocus type="button" variant="outline" disabled={saving} onClick={onClose}>{uncertain ? "Tutup" : "Batal"}</Button>
        <Button type="button" variant={destructive ? "destructive" : "default"} className={destructive ? "plot-delete-action" : undefined} disabled={saving || uncertain} onClick={confirm}>{saving ? "Memproses…" : actionLabel}</Button>
      </footer>
    </div>
  </dialog>;
}
