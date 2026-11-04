import { auth } from "@/auth";
import { isAllowedGoogleAccount } from "@/features/auth/allowlist";
import { getAppearance } from "@/features/settings/data/appearance-source";
import { defaultAppearance } from "@/features/settings/lib/appearance";
import { Suspense } from "react";
import { connection } from "next/server";
import { Database, RefreshCw } from "lucide-react";
import { AppearancePreview } from "@/features/settings/components/appearance-preview";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import type { DataSourceStatus } from "@/features/dashboard/data/source-types";

const labels: Record<DataSourceStatus["state"], string> = {
  connected: "Terhubung", stale: "Data tersimpan; pembacaan terakhir gagal", failed: "Tidak terhubung", demo: "Data demo",
};

function SourceCard({ title, status }: { title: string; status: DataSourceStatus | null }) {
  const lastSync = status?.lastSuccessAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(new Date(status.lastSuccessAt)) + " WITA" : "Belum tersedia";
  return <article className="settings-source-card">
    <header className="settings-source-header"><div className="settings-source-title"><span className="settings-source-icon"><Database aria-hidden="true" /></span><div><h3>{title}</h3><p>{!status ? "Sumber tidak tersedia" : status.source === "mock" ? "Data demo" : "Google Sheets"}</p></div></div><span className="settings-source-status" data-state={status?.state ?? "failed"}><span aria-hidden="true" />{status ? labels[status.state] : "Tidak tersedia"}</span></header>
    <dl className="settings-source-details"><div><dt>Worksheet</dt><dd>{status?.worksheet ?? "Belum tersedia"}</dd></div><div><dt><RefreshCw size={14} aria-hidden="true" /> Sinkronisasi terakhir</dt><dd>{lastSync}</dd></div></dl>
    {status?.error && <p className="settings-source-error" role="status">{status.error.message} {status.error.nextAction}</p>}
  </article>;
}

async function SettingsContent() {
  await connection();
  const [operation, finance, appearance] = await Promise.all([getDashboardData(), getFinanceData(), getAppearance()]);
  const authReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
  const session = authReady ? await auth() : null;
  const userEmail = isAllowedGoogleAccount(session?.user?.email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS) ? session?.user?.email ?? null : null;
  const writerReady = process.env.ENABLE_SETTINGS_WRITES === "true" && Boolean(process.env.GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_WRITER_PRIVATE_KEY);
  return <main className="directory-page settings-page"><header className="directory-heading"><div><span className="directory-eyebrow">SISTEM</span><h1>Pengaturan</h1><p>Kelola identitas aplikasi dan pantau sumber data.</p></div></header><AppearancePreview initial={appearance ?? defaultAppearance} available={Boolean(appearance)} authReady={authReady} writerReady={writerReady} userEmail={userEmail} /><section className="settings-sources" aria-labelledby="settings-sources"><div className="settings-section-heading"><div><h2 id="settings-sources" className="settings-section-title">Sumber data</h2><p>Status pembacaan data operasional dan keuangan.</p></div></div><div className="settings-source-grid"><SourceCard title="Operasional" status={operation.status} /><SourceCard title="Keuangan" status={finance?.status ?? null} /></div></section></main>;
}

export default function SettingsPage() {
  return <Suspense fallback={<DashboardLoading layout="settings" />}><SettingsContent /></Suspense>;
}
