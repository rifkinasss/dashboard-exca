import { isAdministrator } from "@/features/auth/server/permissions";
import { auth } from "@/auth";
import { administratorEmails } from "@/features/auth/allowlist";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { LoginLink } from "@/features/auth/components/login-link";
import { getAppearance } from "@/features/settings/data/appearance-source";
import { defaultAppearance } from "@/features/settings/lib/appearance";
import { Suspense } from "react";
import { connection } from "next/server";
import { Activity, ArrowRight, BarChart3, Database, Fuel, LockKeyhole, Map, RefreshCw, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { BrandIcon } from "@/components/brand-icon";
import { getFuelPriceCatalog } from "@/features/dashboard/data/server/fuel-price-source";
import { getPlotPrices } from "@/features/management/data/server/plot-price-source";
import { MONTHLY_AREA_TARGET_HA } from "@/features/dashboard/config/monthly-target";
import { AppearancePreview } from "@/features/settings/components/appearance-preview";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { DriveFolderStatus } from "@/features/settings/components/drive-folder-status";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { getFinanceData } from "@/features/finance/data/server/finance-source";
import type { DataSourceStatus } from "@/features/dashboard/data/source-types";
import { readAccessUsers } from "@/features/settings/data/viewer-access";
import { AccessManager } from "@/features/settings/components/access-manager";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Pengaturan" };

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
  const authReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
  const session = authReady ? await auth() : null;
  if (!session?.user) return <main className="directory-page settings-page"><header className="directory-heading"><div><span className="directory-eyebrow">SISTEM</span><h1>Pengaturan</h1></div></header><section className="settings-panel settings-login-prompt" aria-labelledby="settings-login-title"><span className="settings-source-icon"><LockKeyhole aria-hidden="true" /></span><h2 id="settings-login-title">Masuk untuk membuka pengaturan</h2><p>Silakan masuk dengan akun Google untuk mengakses halaman pengaturan.</p><LoginLink className={buttonVariants({ size: "lg" })}>Silakan masuk <ArrowRight aria-hidden="true" /></LoginLink></section></main>;
  const [operation, finance, appearance, fuelPrices, plotPrices] = await Promise.all([getDashboardData(), getFinanceData(), getAppearance(), getFuelPriceCatalog(), getPlotPrices()]);
  const userEmail = await isAdministrator(session?.user?.email) ? session?.user?.email ?? null : null;
  const viewers = userEmail ? await readAccessUsers().catch(() => null) : null;
  const writerReady = process.env.ENABLE_SETTINGS_WRITES === "true" && Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  const releaseVersion = process.env.APP_RELEASE_VERSION?.trim();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const currentPrice = fuelPrices && !fuelPrices.issues.length ? fuelPrices.prices.filter((price) => price.effectiveDate <= today).at(-1) : null;
  const currency = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
  return <main className="directory-page settings-page"><header className="directory-heading"><div><span className="directory-eyebrow">SISTEM</span><h1>Pengaturan</h1><p>Kelola identitas aplikasi dan pantau sumber data.</p></div></header><SettingsTabs panels={{ identitas: <AppearancePreview releaseVersion={releaseVersion} initial={appearance ?? defaultAppearance} available={Boolean(appearance)} authReady={authReady} writerReady={writerReady} userEmail={userEmail} signedIn={Boolean(session?.user)} />, sumber: <section className="settings-sources" aria-labelledby="settings-sources"><div className="settings-section-heading"><div><h2 id="settings-sources" className="settings-section-title">Sumber data</h2><p>Status pembacaan data operasional dan keuangan.</p></div></div><div className="settings-source-grid"><SourceCard title="Operasional" status={operation.status} /><SourceCard title="Keuangan" status={finance?.status ?? null} /></div></section>,
    akses: <section className="settings-sources" aria-labelledby="settings-access">
      <div className="settings-section-heading"><h2 id="settings-access" className="settings-section-title">Pengguna dan hak akses</h2><p>Status akses perubahan data aplikasi.</p></div>
      <div className="settings-source-grid">
        <article className="settings-source-card settings-info-card">
          <div className="settings-info-heading"><span className="settings-source-icon"><ShieldCheck aria-hidden="true" /></span><div><h3>Login Google</h3><p>Akses akun</p></div><span className="settings-info-badge" data-ready={authReady}>{authReady ? "Dikonfigurasi" : "Belum dikonfigurasi"}</span></div>
          {session?.user ? <div className="settings-account-details"><p className="settings-info-description">{session.user.name || "Akun Google"}</p>{session.user.email && <p className="settings-info-note">{session.user.email}</p>}<p className="settings-info-note">{userEmail ? "Akun diizinkan untuk perubahan pengaturan sesuai konfigurasi." : "Akun tidak memiliki akses perubahan."}</p></div> : <p className="settings-info-description">{authReady ? "Masuk dengan akun Google yang diizinkan." : "Login Google diperlukan untuk perubahan data."}</p>}
          {session?.user ? <SignOutButton /> : <Link className="settings-info-link" href="/login">Halaman login <ArrowRight size={16} aria-hidden="true" /></Link>}
          <p className="settings-info-note">Administrator diatur melalui konfigurasi server.</p>
        </article>
        <article className="settings-source-card settings-info-card">
          <div className="settings-info-heading"><span className="settings-source-icon"><LockKeyhole aria-hidden="true" /></span><div><h3>Perubahan pengaturan</h3><p>Akses penyimpanan</p></div><span className="settings-info-badge" data-ready={writerReady}>{writerReady ? "Dikonfigurasi" : "Belum dikonfigurasi"}</span></div>
          <p className="settings-info-description">{writerReady ? "Akun yang diizinkan dapat menyimpan identitas aplikasi." : "Penyimpanan identitas belum dikonfigurasi."}</p>
        </article>
      </div>
      {userEmail && <div className="settings-access-grid">
        <article className="settings-source-card settings-info-card settings-admin-list">
          <div className="settings-access-heading"><span className="settings-source-icon"><ShieldCheck aria-hidden="true" /></span><div><h3>Owner, Administrator &amp; Developer</h3><p className="settings-info-note">Dikelola melalui konfigurasi server. Ketiganya dapat menginput transaksi.</p></div></div>
          <ul>{administratorEmails(process.env.AUTH_GOOGLE_ALLOWED_EMAILS).map((email) => <li key={email}><span>{email}</span><span className="settings-info-badge" data-role={email === "anashirulrifki@gmail.com" ? "developer" : email === "bpngilang@gmail.com" ? "owner" : "admin"}>{email === "anashirulrifki@gmail.com" ? "Developer" : email === "bpngilang@gmail.com" ? "Owner" : "Admin"}</span></li>)}</ul>
        </article>
        <AccessManager viewers={viewers} />
      </div>}
    </section>,
    drive: <DriveFolderStatus />,
    target: <section className="settings-sources" aria-labelledby="settings-target">
      <div className="settings-section-heading"><h2 id="settings-target" className="settings-section-title">Target operasional</h2><p>Target luas petak yang digunakan dashboard.</p></div>
      <article className="settings-source-card settings-target-card"><span className="settings-source-icon"><Target aria-hidden="true" /></span><div><h3>Target luas bulanan</h3><p>Target yang sama digunakan untuk setiap bulan.</p></div><div className="settings-target-value"><strong>{MONTHLY_AREA_TARGET_HA}</strong><span>Ha / bulan</span></div><p className="settings-target-note">Pengaturan target per bulan belum tersedia.</p></article>
    </section>,
    harga: <section className="settings-sources" aria-labelledby="settings-prices">
      <div className="settings-section-heading"><h2 id="settings-prices" className="settings-section-title">Harga acuan</h2><p>Harga yang digunakan dalam perhitungan.</p></div>
      <div className="settings-source-grid">
        <article className="settings-source-card settings-info-card"><div className="settings-info-heading"><span className="settings-source-icon"><Fuel aria-hidden="true" /></span><div><h3>Harga solar</h3><p>Harga berlaku saat ini</p></div></div><p className="settings-info-value">{currentPrice ? <>{currency(currentPrice.rupiahPerLiter)} <span>/ liter</span></> : "Belum tersedia"}</p><p className="settings-info-note">{fuelPrices?.issues.length ? "Data harga perlu diperiksa sebelum digunakan." : currentPrice ? `Berlaku sejak ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${currentPrice.effectiveDate}T00:00:00Z`))}.` : "Tidak ada harga yang berlaku."}</p><Link className="settings-info-link" href="/solar">Lihat riwayat harga <ArrowRight size={16} aria-hidden="true" /></Link></article>
        <article className="settings-source-card settings-info-card"><div className="settings-info-heading"><span className="settings-source-icon"><Map aria-hidden="true" /></span><div><h3>Harga petak</h3><p>Harga per hektar</p></div></div><p className="settings-info-value">{plotPrices ? <>{plotPrices.length} <span>catatan harga</span></> : "Belum tersedia"}</p><p className="settings-info-note">Harga mengikuti petak dan nomor SPK. Pengelolaan harga petak belum tersedia.</p></article>
      </div>
    </section>,
    tentang: <section className="settings-sources" aria-labelledby="settings-about">
      <div className="settings-section-heading"><h2 id="settings-about" className="settings-section-title">Tentang aplikasi</h2><p>Kenali fungsi dan informasi aplikasi.</p></div>
      <div className="settings-about-layout">
        <article className="settings-source-card settings-about-overview">
          <div className="settings-about-brand"><span className="settings-source-icon"><BrandIcon /></span><div><h3>{appearance?.name ?? defaultAppearance.name}</h3>{releaseVersion && <p>Versi {releaseVersion}</p>}</div></div>
          <p className="settings-about-description">Aplikasi untuk memantau pekerjaan lahan, aktivitas excavator, pembelian solar, dan ringkasan keuangan dalam satu tempat.</p>
          <h4>Yang dapat dipantau</h4>
          <div className="settings-about-features">
            <Link href="/petak"><Map aria-hidden="true" /><span><strong>Petak lahan</strong><small>Luas, status pekerjaan, dan rincian petak</small></span><ArrowRight aria-hidden="true" /></Link>
            <Link href="/aktivitas"><Activity aria-hidden="true" /><span><strong>Aktivitas operasional</strong><small>Riwayat pekerjaan dan jam kerja</small></span><ArrowRight aria-hidden="true" /></Link>
            <Link href="/solar"><Fuel aria-hidden="true" /><span><strong>Pembelian solar</strong><small>Transaksi dan harga solar</small></span><ArrowRight aria-hidden="true" /></Link>
            <Link href="/dashboard/keuangan"><BarChart3 aria-hidden="true" /><span><strong>Keuangan</strong><small>Ringkasan nilai petak dan biaya solar</small></span><ArrowRight aria-hidden="true" /></Link>
          </div>
        </article>
        <div className="settings-about-aside">
          <article className="settings-source-card settings-about-meta">
            <h3>Informasi aplikasi</h3>
            <dl className="settings-source-details"><div><dt>Versi rilis</dt><dd>{releaseVersion || "Belum ditetapkan"}</dd></div><div><dt>Zona waktu</dt><dd>Asia/Makassar · WITA</dd></div><div><dt>Dikembangkan oleh</dt><dd>NasLabs</dd></div></dl>
            {!releaseVersion && <p>Versi rilis akan ditampilkan setelah ditetapkan dalam konfigurasi aplikasi.</p>}
          </article>
          <article className="settings-source-card settings-about-roadmap">
            <h3>Fitur tersedia</h3>
            <ul>
              <li>
                <strong>Pengelolaan hak akses</strong>
                <span>Akun dapat diberi peran akses lihat, penginput, atau admin. Akun administrator utama dikelola melalui konfigurasi server.</span>
              </li>
              <li>
                <strong>Harga dan pembelian solar</strong>
                <span>Pengguna berwenang dapat mengatur harga solar serta menambah dan mengedit catatan pembelian jika izin tulis diaktifkan.</span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section> }} /></main>;
}

export default function SettingsPage() {
  return <Suspense fallback={<DashboardLoading layout="settings" />}><SettingsContent /></Suspense>;
}
