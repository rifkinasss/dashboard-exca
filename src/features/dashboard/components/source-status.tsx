"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { DataSourceStatus } from "../data/source-types";

const syncTime = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Makassar",
}).format(new Date(value));

export function SourceStatus({ status }: { status: DataSourceStatus }) {
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.parse(status.evaluatedAt));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const stale = status.state === "stale" || (status.lastSuccessAt !== null && now - Date.parse(status.lastSuccessAt) >= status.ttlSeconds * 1000);
  const state = status.state === "failed" ? "failed" : stale ? "stale" : "connected";
  const StatusIcon = state === "failed" ? AlertCircle : state === "stale" ? Clock3 : CheckCircle2;
  return (
    <Alert className="source-alert" data-source-state={state} role="status">
      <div className="source-alert-icon"><StatusIcon aria-hidden="true" /></div>
      <div className="source-alert-body">
        <div className="source-alert-heading"><AlertTitle>Google Sheets</AlertTitle><Badge variant="outline" className="source-alert-badge">{state === "failed" ? "Sinkronisasi gagal" : state === "stale" ? "Perlu diperbarui" : "Terhubung"}</Badge></div>
        <AlertDescription className="source-alert-description">
          <p>{status.lastSuccessAt ? `Sinkronisasi terakhir: ${syncTime(status.lastSuccessAt)} WITA.` : "Belum ada sinkronisasi berhasil."} Cache server {status.ttlSeconds} detik.</p>
          {status.error && <p>Sinkronisasi gagal ({status.error.category}{status.error.reason ? ` · ${status.error.reason}` : ""}). {status.error.message} {status.error.nextAction}</p>}
          {status.error?.columns && <p>Posisi yang perlu diperiksa: {status.error.columns.join("; ")}.</p>}
          {stale && <p>Snapshot belum diperiksa ulang; data sumber mungkin sudah berubah.</p>}
          <p>Pemeriksaan sumber dilakukan saat halaman dimuat ulang setelah interval cache.</p>
        </AlertDescription>
      </div>
      <Button variant="outline" size="sm" className="source-alert-refresh" disabled={refreshing} onClick={() => { setRefreshing(true); window.location.reload(); }}><RefreshCw data-icon="inline-start" aria-hidden="true" />{refreshing ? "Memuat ulang…" : "Perbarui data"}</Button>
    </Alert>
  );
}
