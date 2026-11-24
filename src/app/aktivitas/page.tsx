import { ManagementRecordRoute } from "@/features/management/components/record-management-page";
import { ManagementGate } from "@/features/auth/components/management-gate";

export const metadata = { title: "Aktivitas Operasional" };

export default function ActivityPage() { return <ManagementGate layout="activity" title="Aktivitas Operasional"><ManagementRecordRoute kind="activity" /></ManagementGate>; }
