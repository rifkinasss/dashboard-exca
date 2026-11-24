import { ManagementPage } from "@/features/management/components/management-page";
import { ManagementGate } from "@/features/auth/components/management-gate";

export const metadata = { title: "Data SPK" };

export default function SpkPage() { return <ManagementGate layout="spk" title="Data SPK"><ManagementPage kind="spk" /></ManagementGate>; }
