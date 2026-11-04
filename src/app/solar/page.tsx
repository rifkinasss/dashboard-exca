import { Suspense } from "react";
import { connection } from "next/server";
import { auth } from "@/auth";
import { isAllowedGoogleAccount } from "@/features/auth/allowlist";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { FuelWithdrawalDirectory } from "@/features/dashboard/components/fuel-withdrawal-directory";
import { getFuelPriceCatalog } from "@/features/dashboard/data/server/fuel-price-source";
import { getFuelWithdrawals } from "@/features/dashboard/data/server/fuel-withdrawal-source";
import { fuelPriceWriterReady } from "@/features/dashboard/data/server/fuel-price-writer";
import { withdrawalWriterReady } from "@/features/dashboard/data/server/fuel-withdrawal-writer";

async function SolarContent() {
  await connection();
  const [data, priceCatalog] = await Promise.all([getFuelWithdrawals(), getFuelPriceCatalog()]);
  if (!data) return <main className="directory-main"><div className="directory-notice" role="alert">Data pengambilan solar belum dapat dibaca. Periksa koneksi dan konfigurasi sumber. Sistem akan mencoba lagi secara otomatis.</div></main>;
  const authReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
  const session = authReady ? await auth() : null;
  const userEmail = isAllowedGoogleAccount(session?.user?.email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS) ? session?.user?.email ?? null : null;
  return <div className="directory-main"><FuelWithdrawalDirectory data={data} priceCatalog={priceCatalog} authReady={authReady} writerReady={authReady && withdrawalWriterReady()} priceWriterReady={authReady && fuelPriceWriterReady()} userEmail={userEmail} /></div>;
}

export default function SolarPage() { return <Suspense fallback={<DashboardLoading section="operasional" />}><SolarContent /></Suspense>; }
