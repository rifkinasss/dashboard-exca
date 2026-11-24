import { isAdministrator } from "@/features/auth/server/permissions";
import { Suspense } from "react";
import { connection } from "next/server";
import { auth } from "@/auth";
import { canInputTransactions } from "@/features/auth/allowlist";
import { DashboardLoading } from "@/components/layout/dashboard-loading";
import { FuelWithdrawalDirectory } from "@/features/dashboard/components/fuel-withdrawal-directory";
import { getFuelPriceCatalog } from "@/features/dashboard/data/server/fuel-price-source";
import { getFuelWithdrawals } from "@/features/dashboard/data/server/fuel-withdrawal-source";
import { fuelPriceWriterReady } from "@/features/dashboard/data/server/fuel-price-writer";
import { withdrawalWriterReady } from "@/features/dashboard/data/server/fuel-withdrawal-writer";
import { ManagementGate } from "@/features/auth/components/management-gate";
import { readAccessUsers } from "@/features/settings/data/viewer-access";
import { fuelSheetConfig } from "@/features/dashboard/lib/fuel-sheet-config";

export const metadata = { title: "Pembelian Solar" };

async function SolarContent() {
  await connection();
  const [data, priceCatalog] = await Promise.all([getFuelWithdrawals(), getFuelPriceCatalog()]);
  if (!data) return <main className="directory-main"><div className="directory-notice" role="alert">Data pengambilan solar belum dapat dibaca. Periksa koneksi dan konfigurasi sumber. Sistem akan mencoba lagi secara otomatis.</div></main>;
  const authReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ALLOWED_EMAILS);
  const session = authReady ? await auth() : null;
  const userEmail = await isAdministrator(session?.user?.email) ? session?.user?.email ?? null : null;
  const sessionEmail = session?.user?.email;
  const operatorEmail = !userEmail && sessionEmail && await readAccessUsers().then((users) => canInputTransactions(sessionEmail, users)).catch(() => false) ? sessionEmail : null;
  return <div className="directory-main">{fuelSheetConfig(process.env).testing && <p className="directory-notice" role="status">Mode pengujian: pembelian dan harga solar memakai worksheet uji. Dashboard lokal juga menggunakan data pembelian uji.</p>}<FuelWithdrawalDirectory data={data} priceCatalog={priceCatalog} authReady={authReady} writerReady={authReady && withdrawalWriterReady()} priceWriterReady={authReady && fuelPriceWriterReady()} userEmail={userEmail} operatorEmail={operatorEmail} /></div>;
}

export default function SolarPage() { return <ManagementGate layout="solar" title="Pembelian Solar"><Suspense fallback={<DashboardLoading layout="solar" />}><SolarContent /></Suspense></ManagementGate>; }
