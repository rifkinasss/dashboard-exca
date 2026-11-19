"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, FileUp, FolderOpen, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DraftModal } from "./draft-modal";
import { saveSpkDocumentAction } from "../actions/save-spk-document";
import { spkDocumentFolders, type SpkDocumentField, type SpkDocumentRecord } from "../lib/spk-document-folders";

type DriveTokenResponse = { access_token?: string; error?: string };
type PickerDocument = { id?: string; name?: string };
type GooglePickerBuilder = { setAppId: (id: string) => GooglePickerBuilder; setOAuthToken: (token: string) => GooglePickerBuilder; setDeveloperKey: (key: string) => GooglePickerBuilder; addView: (view: unknown) => GooglePickerBuilder; setTitle: (title: string) => GooglePickerBuilder; setCallback: (callback: (data: { action?: string; docs?: PickerDocument[] }) => void) => GooglePickerBuilder; build: () => { setVisible: (visible: boolean) => void } };
type GoogleApi = {
  accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: DriveTokenResponse) => void; error_callback: () => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } } };
  picker: {
    ViewId: { FOLDERS: string };
    Action: { PICKED: string; CANCEL: string };
    DocsView: new (viewId: string) => { setSelectFolderEnabled: (enabled: boolean) => unknown; setMimeTypes: (mimeTypes: string) => unknown; setIncludeFolders: (include: boolean) => unknown };
    PickerBuilder: new () => GooglePickerBuilder;
  };
};
type GoogleWindow = Window & { google?: GoogleApi; gapi?: { load: (name: string, callback: () => void) => void } };
type Draft = { number: string; beritaAcaraNumber: string; payoutNumber: string };
const emptyRecord = (number: string): SpkDocumentRecord => ({ number, spkUrl: "", beritaAcaraNumber: "", beritaAcaraUrl: "", payoutNumber: "", payoutUrl: "", updatedAt: "", updatedBy: "" });

export function SpkFormDialog({ initialNumber = "", existingNumbers, initialRecord, canWrite, writerReady, authReady, pickerApiKey, cloudProjectNumber, cloudClientId, onClose }: {
  initialNumber?: string;
  existingNumbers: string[];
  initialRecord: SpkDocumentRecord | null;
  canWrite: boolean;
  writerReady: boolean;
  authReady: boolean;
  pickerApiKey: string;
  cloudProjectNumber: string;
  cloudClientId: string;
  onClose: () => void;
}) {
  const initial: Draft = { number: initialNumber, beritaAcaraNumber: initialRecord?.beritaAcaraNumber ?? "", payoutNumber: initialRecord?.payoutNumber ?? "" };
  const hasLaterStepData = Boolean(initialRecord?.beritaAcaraNumber || initialRecord?.beritaAcaraUrl || initialRecord?.payoutNumber || initialRecord?.payoutUrl);
  const initialStep = initialRecord ? (hasLaterStepData ? 2 : 1) : 0;
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedDraft, setSavedDraft] = useState<Draft>(initial);
  const [activeStep, setActiveStep] = useState(initialStep);
  const [unlockedStep, setUnlockedStep] = useState(initialStep);
  const [record, setRecord] = useState<SpkDocumentRecord>(initialRecord ?? emptyRecord(initialNumber));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<SpkDocumentField | "save" | null>(null);
  const [connectingFolder, setConnectingFolder] = useState<SpkDocumentField | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [connectedFolders, setConnectedFolders] = useState(() =>
    Object.fromEntries((Object.keys(spkDocumentFolders) as SpkDocumentField[]).map((field) => [
      field,
      localStorage.getItem(`petak-spk-folder-${field}`) === spkDocumentFolders[field].id,
    ])),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState<SpkDocumentField | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Partial<Record<SpkDocumentField, number>>>({});
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const docs: { field: SpkDocumentField; title: string; numberLabel: string; numberKey: keyof Draft; number: string; label: string; url: string }[] = [
    { field: "spk", title: "SPK", numberLabel: "Nomor SPK", numberKey: "number", number: draft.number, label: "Dokumen SPK", url: record.spkUrl },
    { field: "beritaAcara", title: "Berita Acara", numberLabel: "No. Berita Acara", numberKey: "beritaAcaraNumber", number: draft.beritaAcaraNumber, label: "Dokumen Berita Acara", url: record.beritaAcaraUrl },
    { field: "payout", title: "Pencairan", numberLabel: "No. Pencairan", numberKey: "payoutNumber", number: draft.payoutNumber, label: "Bukti Pencairan", url: record.payoutUrl },
  ];

  useEffect(() => {
    const load = (src: string) => new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement("script"); script.src = src; script.async = true; script.defer = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("Skrip Google tidak dapat dimuat.")); document.head.append(script);
    });
    void Promise.all([load("https://accounts.google.com/gsi/client"), load("https://apis.google.com/js/api.js")]).then(() => {
      const gapi = (window as GoogleWindow).gapi;
      if (gapi) gapi.load("picker", () => setGoogleReady(true));
    }).catch(() => setMessage("Google Picker tidak dapat dimuat. Periksa koneksi dan konfigurasi API."));
  }, []);

  function getAccessToken() {
    return new Promise<string>((resolve, reject) => {
      const google = (window as GoogleWindow).google;
      if (!google || !cloudClientId) return reject(new Error("Layanan Google Drive belum siap."));
      const client = google.accounts.oauth2.initTokenClient({ client_id: cloudClientId, scope: "openid email https://www.googleapis.com/auth/drive.file", callback: (response) => response.access_token ? resolve(response.access_token) : reject(new Error(response.error || "Izin Google Drive tidak diberikan.")), error_callback: () => reject(new Error("Popup izin Google Drive gagal dibuka.")) });
      client.requestAccessToken({ prompt: "" });
    });
  }

  function chooseFolder(field: SpkDocumentField, token: string) {
    return new Promise<string>((resolve, reject) => {
      const google = (window as GoogleWindow).google;
      const gapi = (window as GoogleWindow).gapi;
      if (!google || !gapi || !pickerApiKey || !cloudProjectNumber) return reject(new Error("Picker belum siap. Muat ulang halaman setelah konfigurasi Google selesai."));
      gapi.load("picker", () => {
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS);
        view.setIncludeFolders(true); view.setSelectFolderEnabled(true); view.setMimeTypes("application/vnd.google-apps.folder");
        const picker = new google.picker.PickerBuilder().setAppId(cloudProjectNumber).setOAuthToken(token).setDeveloperKey(pickerApiKey).setTitle(`Pilih folder ${spkDocumentFolders[field].name}`).addView(view).setCallback((data) => {
          if (data.action === google.picker.Action.CANCEL) return reject(new Error("Pemilihan folder dibatalkan."));
          if (data.action !== google.picker.Action.PICKED) return;
          const id = data.docs?.[0]?.id;
          if (!id || id !== spkDocumentFolders[field].id) return reject(new Error(`Pilih folder ${spkDocumentFolders[field].name} yang sudah disiapkan.`));
          localStorage.setItem(`petak-spk-folder-${field}`, id); resolve(id);
        }).build();
        picker.setVisible(true);
      });
    });
  }

  function uploadToDrive(url: string, method: "POST" | "PATCH", token: string, body: File | FormData, field: SpkDocumentField, contentType?: string) {
    return new Promise<{ id?: string }>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, url);
      request.setRequestHeader("Authorization", `Bearer ${token}`);
      if (contentType) request.setRequestHeader("Content-Type", contentType);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress((current) => ({ ...current, [field]: Math.min(95, Math.round(event.loaded / event.total * 95)) }));
      };
      request.onerror = () => reject(new Error("Koneksi terputus saat mengunggah PDF."));
      request.onload = () => {
        if (request.status < 200 || request.status >= 300) return reject(new Error("PDF gagal diunggah ke Google Drive. Pastikan Google Drive API sudah diaktifkan."));
        try { resolve(JSON.parse(request.responseText) as { id?: string }); }
        catch { reject(new Error("Respons Google Drive tidak dapat dibaca.")); }
      };
      request.send(body);
    });
  }

  async function connectFolder(field: SpkDocumentField) {
    setMessage(""); setErrors([]);
    if (!draft.number.trim()) { setErrors(["Simpan nomor SPK terlebih dahulu sebelum mengunggah dokumen."]); return; }
    try {
      setConnectingFolder(field);
      const token = await getAccessToken();
      setPickerOpen(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await chooseFolder(field, token);
      setConnectedFolders((current) => ({ ...current, [field]: true }));
      setMessage(`Folder ${spkDocumentFolders[field].name} berhasil dihubungkan. Sekarang pilih PDF untuk diunggah.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Tidak dapat membuka Google Picker."); }
    finally { setPickerOpen(false); setConnectingFolder(null); }
  }

  async function upload(field: SpkDocumentField, file: File | undefined) {
    if (!file) { setBusy(null); return; }
    setMessage("");
    setBusy(field);
    setUploadProgress((current) => ({ ...current, [field]: 0 }));
    try {
      if (file.type !== "application/pdf" || !file.name.toLocaleLowerCase("id-ID").endsWith(".pdf") || file.size > 15 * 1024 * 1024) throw new Error("Pilih file PDF dengan ukuran maksimal 15 MB.");
      const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (new TextDecoder().decode(signature) !== "%PDF-") throw new Error("Isi file tidak dikenali sebagai PDF.");
      const folderId = localStorage.getItem(`petak-spk-folder-${field}`);
      if (folderId !== spkDocumentFolders[field].id) throw new Error("Folder dokumen belum dipilih. Silakan ulangi." );
      const token = await getAccessToken();
      const slot = `${draft.number.trim()}:${field}`;
      const query = `'${folderId}' in parents and appProperties has { key='petak_spk_slot' and value='${slot.replaceAll("'", "\\'")}' }`;
      const existingResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (!existingResponse.ok) throw new Error("Folder Drive tidak dapat diakses. Pastikan Google Drive API sudah diaktifkan.");
      const existing = await existingResponse.json() as { files?: { id?: string }[] };
      const existingId = existing.files?.[0]?.id;
      let uploaded: { id?: string };
      if (existingId) uploaded = await uploadToDrive(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media&fields=id`, "PATCH", token, file, field, "application/pdf");
      else {
        const metadata = { name: file.name, mimeType: "application/pdf", parents: [folderId], appProperties: { petak_spk_slot: slot } };
        const body = new FormData(); body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" })); body.append("file", file);
        uploaded = await uploadToDrive("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", "POST", token, body, field);
      }
      if (!uploaded.id) throw new Error("Google Drive tidak mengembalikan ID file.");
      const result = await saveSpkDocumentAction({ number: draft.number.trim(), beritaAcaraNumber: draft.beritaAcaraNumber, payoutNumber: draft.payoutNumber, field, fileId: uploaded.id, accessToken: token });
      if (!result.ok) throw new Error(result.message);
      setUploadProgress((current) => ({ ...current, [field]: 100 }));
      setRecord((current) => ({ ...current, number: draft.number.trim(), beritaAcaraNumber: draft.beritaAcaraNumber, payoutNumber: draft.payoutNumber, ...(field === "spk" ? { spkUrl: result.url ?? "" } : {}), ...(field === "beritaAcara" ? { beritaAcaraUrl: result.url ?? "" } : {}), ...(field === "payout" ? { payoutUrl: result.url ?? "" } : {}), updatedAt: new Date().toISOString() }));
      setSavedDraft({ ...draft, number: draft.number.trim() });
      setUnlockedStep((current) => Math.max(current, activeStep + 1));
      setMessage(`${spkDocumentFolders[field].name} berhasil diunggah dan dicatat.`);
    } catch (error) {
      setUploadProgress((current) => { const next = { ...current }; delete next[field]; return next; });
      setMessage(error instanceof Error ? error.message : "Unggah dokumen gagal.");
    }
    finally { setBusy(null); }
  }

  async function save() {
    const number = draft.number.trim();
    const issue = !number ? "Nomor SPK wajib diisi." : existingNumbers.some((item) => item.trim() === number && number !== initialNumber) ? "Nomor SPK sudah tercatat." : "";
    if (issue) { setErrors([issue]); return; }
    setBusy("save"); setErrors([]); setMessage("");
    const result = await saveSpkDocumentAction({ number, beritaAcaraNumber: draft.beritaAcaraNumber, payoutNumber: draft.payoutNumber });
    setBusy(null);
    if (!result.ok) { setMessage(result.message); return; }
    setRecord((current) => ({ ...current, number, beritaAcaraNumber: draft.beritaAcaraNumber, payoutNumber: draft.payoutNumber }));
    const saved = { ...draft, number };
    setSavedDraft(saved);
    setUnlockedStep((current) => Math.max(current, activeStep + 1));
    if (activeStep < docs.length - 1 && activeStep === unlockedStep) setActiveStep((current) => current + 1);
    setMessage(result.message);
  }

  const saveReady = canWrite && writerReady && authReady;
  const uploadReady = saveReady && googleReady && Boolean(pickerApiKey && cloudProjectNumber && cloudClientId);
  return <DraftModal
    wide
    className="spk-document-dialog"
    suspend={pickerOpen}
    title={initialNumber ? `Administrasi SPK ${initialNumber}` : "Tambah SPK"}
    description="Simpan nomor SPK dan unggah PDF ke folder Drive yang sesuai."
    dirty={dirty}
    onClose={onClose}
    onReset={() => { setDraft(savedDraft); setErrors([]); setMessage(""); }}
    onSave={save}
    saving={busy !== null}
    saveDisabled={!saveReady || connectingFolder !== null}
  >
    <div className="management-form-section">
      <h3>Administrasi dan dokumen</h3>
      <ol className="spk-stepper" aria-label="Tahapan administrasi SPK">
        {docs.map(({ title }, index) => (
          <li key={title}>
            <button type="button" className={activeStep === index ? "is-active" : index < unlockedStep ? "is-complete" : ""} aria-current={activeStep === index ? "step" : undefined} disabled={index > unlockedStep || busy !== null || dirty} onClick={() => { setActiveStep(index); setMessage(""); setErrors([]); }}>
              <span aria-hidden="true">{index < unlockedStep ? <Check size={15} /> : index + 1}</span>{title}
            </button>
          </li>
        ))}
      </ol>
      <p className="spk-step-hint">Langkah {activeStep + 1} dari {docs.length}. Simpan langkah ini untuk lanjut ke tahap berikutnya.</p>
      <div className="spk-document-list">
        {docs.map(({ field, title, numberLabel, numberKey, number, label, url }, index) => index === activeStep && (
          <section key={field} className="spk-document-field">
            <h4>{title}</h4>
            <label>
              <span className="spk-number-label">
                {numberLabel}
                {field === "spk" ? <span className="management-required" aria-hidden="true">*</span> : <span className="spk-optional-badge">Opsional</span>}
              </span>
              <Input
                autoFocus={index === 0}
                disabled={busy !== null}
                required={field === "spk"}
                value={number}
                aria-invalid={field === "spk" && errors.some((error) => error.includes("Nomor SPK"))}
                onChange={(event) => setDraft({ ...draft, [numberKey]: event.target.value })}
                placeholder={field === "spk" ? "Nomor SPK sebagai teks" : "Masukkan nomor jika tersedia"}
              />
            </label>
            <div className="spk-document-upload">
              <input
                id={`spk-file-${field}`}
                type="file"
                accept="application/pdf,.pdf"
                className="spk-file-input"
                aria-label={`Pilih PDF ${label}`}
                disabled={!uploadReady || busy !== null || !connectedFolders[field]}
                onChange={(event) => { void upload(field, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
              />
              <div className="spk-document-upload-controls">
                <label
                  htmlFor={`spk-file-${field}`}
                  className={`spk-upload-drop${dragging === field ? " is-dragging" : ""}${!uploadReady || busy !== null || !connectedFolders[field] ? " is-disabled" : ""}`}
                  onDragOver={(event) => { event.preventDefault(); if (uploadReady && busy === null && connectedFolders[field]) setDragging(field); }}
                  onDragLeave={() => setDragging((current) => current === field ? null : current)}
                  onDrop={(event) => { event.preventDefault(); setDragging(null); if (uploadReady && busy === null && connectedFolders[field]) void upload(field, event.dataTransfer.files[0]); }}
                >
                  {busy === field ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
                  <span>
                    <strong>{busy === field ? uploadProgress[field] === 95 ? "Menyimpan dokumen…" : `Mengunggah PDF · ${uploadProgress[field] ?? 0}%` : uploadProgress[field] === 100 ? "Dokumen tersimpan · 100%" : url ? "Lepas PDF untuk mengganti dokumen" : "Lepas PDF di sini atau klik untuk memilih"}</strong>
                    <small>{busy === field ? uploadProgress[field] === 95 ? "Mencatat dokumen ke sheet" : "Mengunggah file ke Google Drive" : uploadProgress[field] === 100 ? "PDF tersimpan di Drive dan sheet" : connectedFolders[field] ? "PDF maksimal 15 MB · tersimpan langsung setelah unggah" : "Hubungkan folder Drive terlebih dahulu"}</small>
                  </span>
                </label>
                {(busy === field || uploadProgress[field] === 100) && <div className="spk-upload-progress" role="progressbar" aria-label={`Progres unggah ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress[field] ?? 0}><span style={{ width: `${uploadProgress[field] ?? 0}%` }} /></div>}
                <div className="spk-document-actions">
                  <Button className="spk-folder-button" type="button" variant="outline" disabled={!uploadReady || busy !== null || connectingFolder !== null} onClick={() => void connectFolder(field)}>
                    {connectingFolder === field ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : connectedFolders[field] ? <Check data-icon="inline-start" aria-hidden="true" /> : <FolderOpen data-icon="inline-start" aria-hidden="true" />}
                    {connectingFolder === field ? "Memilih folder…" : connectedFolders[field] ? "Folder terhubung" : "Hubungkan folder Drive"}
                  </Button>
                  {url && <a href={url} target="_blank" rel="noreferrer">Lihat {label.toLocaleLowerCase("id-ID")} <ExternalLink size={14} aria-hidden="true" /></a>}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
    {errors.length > 0 && <ul className="management-form-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    {message && <p className="management-form-notice" role="status">{message}</p>}
    {!canWrite && <p className="management-form-notice" role="status">Masuk dengan akun administrator untuk mengelola dokumen.</p>}
    {canWrite && !saveReady && <p className="management-form-notice" role="status">Penyimpanan dokumen SPK belum diaktifkan atau konfigurasi login belum siap.</p>}
    {canWrite && saveReady && !uploadReady && <p className="management-form-notice" role="status">Google Picker belum siap dimuat atau variabel Picker belum tersedia.</p>}
  </DraftModal>;
}
