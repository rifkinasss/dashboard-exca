import { ManagementRecordRoute } from "@/features/management/components/record-management-page";
import { ManagementGate } from "@/features/auth/components/management-gate";

export const metadata = { title: "Data Keuangan" };

export default function KeuanganPage() { return <ManagementGate title="Data Keuangan"><ManagementRecordRoute kind="finance" /></ManagementGate>; }
