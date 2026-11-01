"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { dashboardHref, dashboardPaths } from "@/features/dashboard/lib/dashboard-navigation";
import { DashboardLoading } from "./dashboard-loading";

export function DashboardHeader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [loading, setLoading] = useState<"operasional" | "keuangan" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const links = [
    { href: dashboardPaths.operasional, label: "Operasional" },
    { href: dashboardPaths.keuangan, label: "Keuangan" },
  ];
  return <header className="app-header">
    <div className="app-header-inner">
      <div className="app-brand"><span className="app-brand-icon"><Image src="/icon.svg" width={32} height={32} alt="" /></span><span><strong>Excavator Monitoring</strong><small>Petak &amp; Solar Analytics</small></span></div>
      <nav className="dashboard-nav" aria-label="Dashboard">
        {links.map(({ href, label }) => <Link key={href} href={dashboardHref(href, search)} aria-current={pathname === href ? "page" : undefined} onNavigate={() => {
          if (pathname === href) return;
          setLoading(href === dashboardPaths.keuangan ? "keuangan" : "operasional");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setLoading(null), 1200);
        }}>{label}</Link>)}
      </nav>
    </div>
    {loading && <div className="dashboard-navigation-loading"><DashboardLoading section={loading} /></div>}
  </header>;
}
