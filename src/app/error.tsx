"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-state" role="alert"><h1>Dashboard belum dapat ditampilkan</h1><p>Terjadi kesalahan saat menyiapkan data monitoring. Silakan coba lagi.</p><Button variant="outline" onClick={reset}>Coba lagi</Button></main>;
}
