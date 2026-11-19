"use client";

import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { spkDocumentFolders, type SpkDocumentField } from "@/features/management/lib/spk-document-folders";

const fields: SpkDocumentField[] = ["spk", "beritaAcara", "payout"];

export function DriveFolderStatus() {
  const [configured, setConfigured] = useState<Partial<Record<SpkDocumentField, boolean>> | null>(null);

  useEffect(() => {
    const read = () => setConfigured(Object.fromEntries(fields.map((field) => [field, localStorage.getItem(`petak-spk-folder-${field}`) === spkDocumentFolders[field].id])));
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return <section className="settings-sources" aria-labelledby="settings-drive-folders">
    <div className="settings-section-heading">
      <h2 id="settings-drive-folders" className="settings-section-title">Folder dokumen SPK</h2>
      <p>Status folder tujuan untuk dokumen SPK, Berita Acara, dan Pencairan.</p>
    </div>
    <div className="settings-source-grid">
      {fields.map((field) => {
        const ready = configured?.[field] === true;
        return <article className="settings-source-card settings-info-card" key={field}>
          <div className="settings-info-heading">
            <span className="settings-source-icon"><FolderOpen aria-hidden="true" /></span>
            <div><h3>{spkDocumentFolders[field].name === "BA" ? "Berita Acara" : spkDocumentFolders[field].name}</h3><p>Folder Google Drive</p></div>
            <span className="settings-info-badge" data-ready={ready}>{configured === null ? "Memeriksa…" : ready ? "Terkonfigurasi" : "Belum dikonfigurasi"}</span>
          </div>
          <p className="settings-info-description">{ready ? "Folder tujuan sudah dipilih di browser ini." : "Hubungkan folder saat mengelola dokumen SPK."}</p>
        </article>;
      })}
    </div>
    <p className="settings-info-note">Status ini tersimpan per browser dan perangkat. Akun lain tidak perlu mengubah konfigurasi Google Cloud, tetapi perlu memilih folder di browsernya sendiri.</p>
  </section>;
}
