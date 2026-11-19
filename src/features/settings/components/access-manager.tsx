"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@base-ui/react/toast";
import { ChevronDown, LoaderCircle, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addViewer } from "../actions/add-viewer";
import { revokeViewer } from "../actions/revoke-viewer";

export function AccessManager({ viewers }: { viewers: { email: string; role: "viewer" | "operator" | "admin" }[] | null }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "operator" | "admin">("viewer");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const router = useRouter();
  const toast = Toast.useToastManager();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const id = toast.add({ title: "Menambahkan akses…", type: "loading", timeout: 0 });
    try {
      const result = await addViewer(email, role);
      toast.update(id, { title: result.ok ? "Akses ditambahkan" : "Tidak berhasil", description: result.message, type: result.ok ? "success" : "error", timeout: 6000 });
      if (result.ok) { setEmail(""); router.refresh(); }
    } catch { toast.update(id, { title: "Hasil belum pasti", description: "Periksa daftar sebelum mencoba lagi.", type: "error", timeout: 0 }); }
    finally { setSaving(false); }
  }
  async function revoke(viewer: string) {
    setSaving(true);
    const id = toast.add({ title: "Mencabut akses…", type: "loading", timeout: 0 });
    try {
      const result = await revokeViewer(viewer);
      toast.update(id, { title: result.ok ? "Akses dicabut" : "Tidak berhasil", description: result.message, type: result.ok ? "success" : "error", timeout: 6000 });
      if (result.ok) { setConfirming(null); router.refresh(); }
    } catch { toast.update(id, { title: "Hasil belum pasti", description: "Periksa daftar sebelum mencoba lagi.", type: "error", timeout: 0 }); }
    finally { setSaving(false); }
  }
  return <article className="settings-source-card settings-info-card settings-access-manager">
    <div className="settings-access-heading"><span className="settings-source-icon"><UsersRound aria-hidden="true" /></span><div><h3>Pengguna aplikasi</h3><p className="settings-info-note">Kelola akses lihat, penginput transaksi, dan administrator.</p></div></div>
    {viewers === null ? <p role="status">Daftar akses belum dapat dibaca.</p> : <>
      {viewers.length ? <ul>{viewers.map((viewer) => <li key={viewer.email}><span>{viewer.email} <span className="settings-info-badge" data-role={viewer.role}>{viewer.role === "operator" ? "Penginput" : viewer.role === "admin" ? "Admin" : "Akses lihat"}</span></span>{confirming === viewer.email ? <span className="settings-access-confirm">Cabut akses? <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirming(null)}>Batal</Button> <Button type="button" variant="destructive" disabled={saving} onClick={() => revoke(viewer.email)}><UserMinus aria-hidden="true" /> Ya, cabut</Button></span> : <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirming(viewer.email)}><UserMinus aria-hidden="true" /> Cabut akses</Button>}</li>)}</ul> : <p className="settings-access-empty">Belum ada pengguna tambahan.</p>}
      <form onSubmit={submit}><label htmlFor="viewer-email">Email Google</label><Input id="viewer-email" type="email" required placeholder="nama@gmail.com" value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="access-role">Peran</label><div className="settings-access-input"><div className="settings-access-select"><select id="access-role" value={role} onChange={(event) => setRole(event.target.value as "viewer" | "operator" | "admin")}><option value="viewer">Akses lihat</option><option value="operator">Penginput</option><option value="admin">Admin</option></select><ChevronDown aria-hidden="true" size={16} /></div><Button type="submit" variant="outline" disabled={saving}>{saving ? <><LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> Menyimpan…</> : <><UserPlus aria-hidden="true" /> Tambah akses</>}</Button></div></form>
    </>}
  </article>;
}
