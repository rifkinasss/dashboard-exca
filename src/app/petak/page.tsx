import { ManagementPage } from "@/features/management/components/management-page";
import { ManagementGate } from "@/features/auth/components/management-gate";

export const metadata = { title: "Petak Lahan" };

export default function PetakPage() { return <ManagementGate title="Petak Lahan"><ManagementPage kind="petak" /></ManagementGate>; }
