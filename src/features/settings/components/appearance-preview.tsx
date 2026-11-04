"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, LayoutDashboard, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAppearance } from "../actions/save-appearance";
import { themes, validateAppearance, type Appearance, type Theme } from "../lib/appearance";

export function AppearancePreview({ initial, available, authReady, writerReady, userEmail }: { initial: Appearance; available: boolean; authReady: boolean; writerReady: boolean; userEmail: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const color = themes[theme].color;
  async function save() {
    setSaving(true); setMessage("");
    try {
      const result = await saveAppearance({ name, theme });
      setMessage(result.message);
      if (result.ok) { window.dispatchEvent(new Event("appearance-saved")); router.refresh(); }
    } catch { setMessage("Hasil penyimpanan belum dapat dipastikan. Periksa kembali sebelum mencoba."); }
    finally { setSaving(false); }
  }
  return <section className="settings-panel" aria-labelledby="appearance-title">
    <header className="settings-panel-heading"><div className="settings-icon"><Palette aria-hidden="true" /></div><div><h2 id="appearance-title">Identitas aplikasi</h2><p>Sesuaikan tampilan identitas aplikasi.</p></div></header>
    <div className="settings-appearance-grid"><div className="settings-fields"><label htmlFor="appearance-name">Nama aplikasi</label><Input id="appearance-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      <fieldset><legend>Warna utama</legend><div className="settings-colors">{(Object.keys(themes) as Theme[]).map((key) => <label key={key} className="settings-color-option"><input type="radio" name="appearance-color" value={key} checked={theme === key} onChange={() => setTheme(key)} /><span style={{ backgroundColor: themes[key].color }} aria-hidden="true" />{themes[key].label}<Check className="settings-color-check" size={15} aria-hidden="true" /></label>)}</div></fieldset>
      <p className="settings-preview-notice" role="status">{message || (!available ? "Pengaturan sumber belum dapat dibaca. Penyimpanan tidak tersedia." : !authReady ? "Login Google belum dikonfigurasi. Perubahan hanya berupa pratinjau." : !userEmail ? "Masuk dengan akun Google yang diizinkan untuk menyimpan." : !writerReady ? "Penyimpanan pengaturan belum dikonfigurasi." : "Perubahan berlaku untuk seluruh pengguna setelah disimpan.")}</p>
      {authReady && !userEmail && <Button type="button" variant="outline" onClick={() => signIn("google", { redirectTo: "/pengaturan" })}>Masuk dengan Google</Button>}
      <Button type="button" onClick={save} disabled={!available || !authReady || !writerReady || !userEmail || !validateAppearance(name, theme) || saving}>{saving ? "Menyimpan…" : "Simpan perubahan"}</Button></div>
      <div className="settings-preview"><div className="settings-preview-header"><span>Pratinjau tampilan</span><span>Contoh</span></div><div className="settings-preview-window"><div className="settings-preview-brand"><div style={{ backgroundColor: color }} aria-hidden="true"><Palette size={18} /></div><div><strong>{name.trim() || "Nama aplikasi"}</strong><small>Management System</small></div></div><div className="settings-preview-nav" style={{ color, borderLeftColor: color }}><LayoutDashboard size={17} aria-hidden="true" /> Dashboard</div></div></div></div>
  </section>;
}
