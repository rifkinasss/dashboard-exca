"use client";

import { Toast } from "@base-ui/react/toast";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LayoutDashboard, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAppearance } from "../actions/save-appearance";
import { appearanceColor, isHexColor, themes, validateAppearance, type Appearance, type Theme } from "../lib/appearance";

export function AppearancePreview({ initial, available, authReady, writerReady, userEmail, signedIn, releaseVersion }: { initial: Appearance; available: boolean; authReady: boolean; writerReady: boolean; userEmail: string | null; signedIn: boolean; releaseVersion?: string }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [name, setName] = useState(initial.name);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const color = appearanceColor(theme);
  async function save() {
    setSaving(true); setMessage("");
    const toastId = toast.add({ title: "Memproses pengaturan…", type: "loading", timeout: 0 });
    try {
      const result = await saveAppearance({ name, theme, previous: saved });
      toast.update(toastId, { title: result.ok ? "Berhasil" : result.message.includes("belum dapat dipastikan") || result.message.includes("belum pasti") ? "Hasil belum dapat dipastikan" : "Tidak berhasil", description: result.message, type: result.ok ? "success" : "error", timeout: 6000, priority: result.ok ? "low" : "high" });
      setMessage(result.message);
      if (result.ok && result.appearance) { setSaved(result.appearance); setName(result.appearance.name); setTheme(result.appearance.theme); window.dispatchEvent(new Event("appearance-saved")); router.refresh(); }
    } catch { toast.update(toastId, { title: "Hasil belum dapat dipastikan", description: "Periksa data sebelum mencoba lagi.", type: "error", timeout: 0, priority: "high" }); setMessage("Hasil penyimpanan belum dapat dipastikan. Periksa kembali sebelum mencoba."); }
    finally { setSaving(false); }
  }
  return <section className="settings-panel" aria-labelledby="appearance-title">
    <header className="settings-panel-heading"><div className="settings-icon"><Palette aria-hidden="true" /></div><div><h2 id="appearance-title">Identitas aplikasi</h2><p>Sesuaikan tampilan identitas aplikasi.</p></div></header>
    <div className="settings-appearance-grid"><div className="settings-fields"><label htmlFor="appearance-name">Nama aplikasi</label><Input id="appearance-name" value={name} maxLength={60} disabled={!userEmail} onChange={(event) => setName(event.target.value)} />
      <fieldset disabled={!userEmail}><legend>Warna utama</legend><div className="settings-colors">{(Object.keys(themes) as (keyof typeof themes)[]).map((key) => <label key={key} className="settings-color-option"><input type="radio" name="appearance-color" value={key} checked={theme === key} onChange={() => setTheme(key)} /><span style={{ backgroundColor: themes[key].color }} aria-hidden="true" />{themes[key].label}<Check className="settings-color-check" size={15} aria-hidden="true" /></label>)}</div><label htmlFor="appearance-custom-color" className="settings-custom-label">Kode warna (HEX)</label><div className="settings-custom-color"><input type="color" aria-label="Pilih warna utama" value={color} onChange={(event) => setTheme(event.target.value.toUpperCase())} /><Input id="appearance-custom-color" value={Object.hasOwn(themes, theme) ? color : theme} maxLength={7} spellCheck={false} placeholder="#EA580C" onChange={(event) => setTheme(event.target.value)} aria-invalid={!Object.hasOwn(themes, theme) && !isHexColor(theme)} /></div><span className="settings-color-help">Contoh: #EA580C</span></fieldset>
      <p className="settings-preview-notice" role="status">{message || (!available ? "Pengaturan sumber belum dapat dibaca. Penyimpanan tidak tersedia." : !authReady ? "Login Google belum dikonfigurasi." : !userEmail ? signedIn ? "Akun ini tidak memiliki izin mengubah pengaturan." : "Masuk sebagai administrator untuk mengubah pengaturan." : !writerReady ? "Penyimpanan pengaturan belum dikonfigurasi." : "Perubahan berlaku untuk seluruh pengguna setelah disimpan.")}</p>
      {!signedIn && authReady && <Link href="/login" className="access-settings-link">Masuk untuk mengatur aplikasi</Link>}
      {userEmail && <Button type="button" onClick={save} disabled={!available || !authReady || !writerReady || !validateAppearance(name, theme) || saving}>{saving ? "Menyimpan…" : "Simpan perubahan"}</Button>}</div>
      <div className="settings-preview"><div className="settings-preview-header"><span>Pratinjau tampilan</span><span>Contoh</span></div><div className="settings-preview-window"><div className="settings-preview-brand"><div style={{ backgroundColor: color }} aria-hidden="true"><Palette size={18} /></div><div><strong>{name.trim() || "Nama aplikasi"}</strong>{releaseVersion && <small>Versi {releaseVersion}</small>}</div></div><div className="settings-preview-nav" style={{ color, borderLeftColor: color }}><LayoutDashboard size={17} aria-hidden="true" /> Dashboard</div></div></div></div>
  </section>;
}
