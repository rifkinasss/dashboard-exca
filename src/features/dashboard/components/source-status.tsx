"use client";

import { AlertCircle, ChevronDown, Clock3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { DataSourceStatus } from "../data/source-types";

const syncTime = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Makassar",
}).format(new Date(value));

export function SourceStatus({ status, compact = false }: { status: DataSourceStatus; compact?: boolean }) {
  if (status.state === "connected" || status.state === "demo") return null;
  const stale = status.state === "stale";
  const state = status.state;
  const StatusIcon = stale ? Clock3 : AlertCircle;
  const alert = (
    <Alert className="source-alert" data-source-state={state} role="status">
      <div className="source-alert-icon"><StatusIcon aria-hidden="true" /></div>
      <div className="source-alert-body">
        <div className="source-alert-heading"><AlertTitle>Google Sheets</AlertTitle><Badge variant="outline" className="source-alert-badge">{state === "failed" ? "Sinkronisasi gagal" : state === "stale" ? "Perlu diperbarui" : "Terhubung"}</Badge></div>
        <AlertDescription className="source-alert-description">
          <p>{status.lastSuccessAt ? `Sinkronisasi terakhir: ${syncTime(status.lastSuccessAt)} WITA.` : "Belum ada sinkronisasi berhasil."}</p>
          {status.error && <p>Sinkronisasi gagal ({status.error.category}{status.error.reason ? ` · ${status.error.reason}` : ""}). {status.error.message} {status.error.nextAction}</p>}
          {status.error?.columns && <p>Posisi yang perlu diperiksa: {status.error.columns.join("; ")}.</p>}
          {stale && <p>Snapshot belum diperiksa ulang; data sumber mungkin sudah berubah.</p>}
          <p>Data akan diperiksa kembali secara otomatis.</p>
        </AlertDescription>
      </div>
    </Alert>
  );
  if (!compact) return alert;
  return <details className="source-alert-disclosure" data-source-state={state} open={state === "failed"}>
    <summary><span className="source-alert-brief"><StatusIcon aria-hidden="true" /><strong>Google Sheets</strong><Badge variant="outline" className="source-alert-badge">{state === "failed" ? "Sinkronisasi gagal" : state === "stale" ? "Perlu diperbarui" : "Terhubung"}</Badge></span><span className="source-alert-last-sync">{status.lastSuccessAt ? `Terakhir ${syncTime(status.lastSuccessAt)} WITA` : "Belum ada sinkronisasi berhasil"}</span><ChevronDown className="source-alert-chevron" aria-hidden="true" /></summary>
    {alert}
  </details>;
}
