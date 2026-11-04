"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DraftModal({ title, description, dirty, wide = false, onClose, onReset, onPreview, children, preview, onSave, saving = false, saveDisabled = false, className = "" }: {
  title: string;
  description: string;
  dirty: boolean;
  wide?: boolean;
  onClose: () => void;
  onReset: () => void;
  onPreview: () => void;
  children: ReactNode;
  preview: ReactNode | null;
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const cancelClose = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => { if (confirmClose) cancelClose.current?.focus(); }, [confirmClose]);
  function close() { dialog.current?.close(); onClose(); }
  function requestClose() {
    if (saving) return;
    if (confirmClose) { setConfirmClose(false); return; }
    if (dirty) { setConfirmClose(true); return; }
    close();
  }
  return <dialog ref={dialog} className={`management-form-dialog${wide ? " is-wide" : ""}${className ? ` ${className}` : ""}`} aria-labelledby="draft-modal-title" onCancel={(event) => { event.preventDefault(); requestClose(); }} onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <form className="management-form" noValidate onSubmit={(event) => event.preventDefault()}>
      <header><div><h2 id="draft-modal-title">{title}</h2><p>{description}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Tutup form" disabled={saving} onClick={requestClose}><X /></Button></header>
      <div className="management-form-content">{confirmClose ? <Alert><AlertTitle>Tutup tanpa menyimpan?</AlertTitle><AlertDescription>Perubahan pada draft ini akan hilang.</AlertDescription></Alert> : <>{children}{preview}</>}</div>
      {confirmClose ? <footer><Button ref={cancelClose} type="button" variant="outline" onClick={() => setConfirmClose(false)}>Lanjutkan mengisi</Button><Button type="button" onClick={close}>Tutup draft</Button></footer> : <footer><Button type="button" variant="outline" disabled={saving} onClick={onReset}>Reset draft</Button><Button type="button" variant="outline" disabled={saving} onClick={onPreview}>Pratinjau</Button><Button type="button" variant="outline" disabled={saving} onClick={requestClose}>Batal</Button><Button type="button" disabled={!onSave || saving || saveDisabled} onClick={onSave}>{saving ? "Menyimpan…" : onSave ? "Simpan" : "Simpan · belum tersedia"}</Button></footer>}
    </form>
  </dialog>;
}

export function DraftPreview({ title, values }: { title: string; values: [string, string][] }) {
  return <section className="management-draft-preview" aria-live="polite"><h3>{title}</h3><dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Belum diisi"}</dd></div>)}</dl><p>Pratinjau lokal saja. Belum disimpan atau dikirim ke Google Sheets.</p></section>;
}
