"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessPage({ configured, error, destination }: { configured: boolean; error: boolean; destination: string }) {
  return (
    <main className="access-page">
      <div className="access-card">
        <span className="access-icon"><ShieldCheck size={24} aria-hidden="true" /></span>
        <p className="access-eyebrow">EXCAVATOR MANAGEMENT SYSTEM</p>
        <h1>Masuk ke aplikasi</h1>
        <p className="access-description">Masuk dengan akun Google untuk mengakses fitur pengelolaan data.</p>
        {error && <p className="access-notice" role="alert">Masuk belum berhasil. Pastikan akun Google Anda sudah diizinkan, lalu coba lagi.</p>}
        {!configured && <p className="access-notice" role="status">Login Google belum dikonfigurasi. Hubungi pengelola aplikasi untuk mengaktifkan akses.</p>}
        <Button variant="outline" className="access-submit" disabled={!configured} onClick={() => signIn("google", { redirectTo: destination })}>
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
            <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z" />
            <path fill="#FBBC05" d="M12.6 27.5a12.2 12.2 0 0 1 0-7.8v-5.2H5.8a20 20 0 0 0 0 18.2l6.8-5.2Z" />
            <path fill="#EA4335" d="M24 11.4c3 0 5.6 1 7.7 3l5.9-5.9A19.7 19.7 0 0 0 24 3.2 20.4 20.4 0 0 0 5.8 14.5l6.8 5.2c1.6-4.8 6.1-8.3 11.4-8.3Z" />
          </svg>
          Lanjutkan dengan Google
        </Button>
        <p className="access-footnote">Hanya akun yang terdaftar dalam daftar akses yang dapat masuk.</p>
        <div className="access-links">
          <Link href="/dashboard/operasional">Kembali ke dashboard</Link>
        </div>
      </div>
    </main>
  );
}
