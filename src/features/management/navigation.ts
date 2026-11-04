import { dashboardHref, dashboardPaths } from "../dashboard/lib/dashboard-navigation";

type NavigationLink = { href: string; label: string; planned: boolean };
type NavigationIcon = "operasional" | "petak" | "spk" | "activity" | "solar" | "keuangan" | "dashboardActivity" | "dashboardFinance" | "settings";
type NavigationItem = (NavigationLink & { icon: NavigationIcon }) | { label: string; icon: NavigationIcon; children: (NavigationLink & { icon: NavigationIcon })[] };

export const managementNavigation: { label: string; items: NavigationItem[] }[] = [
  { label: "Monitoring", items: [
    { label: "Dashboard", icon: "operasional", children: [
      { href: dashboardPaths.operasional, label: "Operasional", icon: "dashboardActivity", planned: false },
      { href: dashboardPaths.keuangan, label: "Keuangan", icon: "dashboardFinance", planned: false },
    ] },
  ] },
  { label: "Manajemen Data", items: [
    { href: "/petak", label: "Petak Lahan", icon: "petak", planned: false },
    { href: "/aktivitas", label: "Aktivitas Operasional", icon: "activity", planned: false },
    { href: "/solar", label: "Pembelian Solar", icon: "solar", planned: false },
    { href: "/keuangan", label: "Data Keuangan", icon: "keuangan", planned: false },
  ] },
  { label: "Sistem", items: [
    { href: "/pengaturan", label: "Pengaturan", icon: "settings", planned: false },
  ] },
];

export function managementHref(path: string, search: string) {
  return path === dashboardPaths.operasional || path === dashboardPaths.keuangan ? dashboardHref(path, search) : path;
}
