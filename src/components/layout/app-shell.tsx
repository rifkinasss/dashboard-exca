"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Fuel,
  LayoutDashboard,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { shouldRefreshData } from "@/features/shared/lib/auto-refresh";
import { defaultAppearance, type Appearance } from "@/features/settings/lib/appearance";
import { dashboardPaths } from "@/features/dashboard/lib/dashboard-navigation";
import {
  managementHref,
  managementNavigation,
} from "@/features/management/navigation";

const icons = {
  dashboardActivity: Activity,
  dashboardFinance: CircleDollarSign,
  operasional: LayoutDashboard,
  petak: Map,
  spk: ClipboardList,
  activity: ClipboardList,
  solar: Fuel,
  keuangan: CircleDollarSign,
  settings: Settings,
};

function Navigation({
  pathname,
  search,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  search: string;
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  const dashboardActive =
    pathname === dashboardPaths.operasional ||
    pathname === dashboardPaths.keuangan;
  const [dashboardOpen, setDashboardOpen] = useState(dashboardActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  return (
    <nav className="management-nav" aria-label="Navigasi utama">
      {managementNavigation.map((group) => (
        <section
          key={group.label}
          className="management-nav-group"
          aria-label={group.label}
        >
          <p className="management-nav-label">{group.label}</p>
          {group.items.map((item) => {
            const Icon = icons[item.icon];
            if ("children" in item) {
              const links = (
                <div className="management-nav-children">
                  {item.children.map((child) => {
                    const ChildIcon = icons[child.icon];
                    return (
                      <Link
                        key={child.href}
                        className="management-nav-link management-nav-child"
                        href={managementHref(child.href, search)}
                        aria-current={
                          pathname === child.href ? "page" : undefined
                        }
                        onNavigate={() => {
                          setFlyoutOpen(false);
                          onNavigate(child.href);
                        }}
                      >
                        <ChildIcon size={16} aria-hidden="true" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              );
              if (collapsed)
                return (
                  <Popover.Root
                    key={item.label}
                    open={flyoutOpen}
                    onOpenChange={setFlyoutOpen}
                  >
                    <Popover.Trigger
                      className="management-nav-link management-nav-parent"
                      aria-label="Dashboard"
                      data-active={dashboardActive || undefined}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="management-nav-popover-positioner"
                      >
                        <Popover.Popup className="management-nav-popover">
                          <Popover.Title className="management-nav-popover-title">
                            Dashboard
                          </Popover.Title>
                          {links}
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                );
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    className="management-nav-link management-nav-parent"
                    aria-expanded={dashboardOpen}
                    data-active={dashboardActive || undefined}
                    onClick={() => setDashboardOpen(!dashboardOpen)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span className="management-nav-text">{item.label}</span>
                    <ChevronDown
                      className={`management-nav-chevron${dashboardOpen ? " is-open" : ""}`}
                      size={16}
                      aria-hidden="true"
                    />
                  </button>
                  {dashboardOpen && links}
                </div>
              );
            }
            const active =
              pathname === item.href ||
              (item.href === "/petak" && (pathname.startsWith("/petak/") || pathname === "/spk"));
            return (
              <Link
                key={item.href}
                className="management-nav-link"
                href={managementHref(item.href, search)}
                aria-current={active ? "page" : undefined}
                aria-label={
                  collapsed
                    ? `${item.label}${item.planned ? ", dalam pengembangan" : ""}`
                    : undefined
                }
                title={
                  collapsed
                    ? `${item.label}${item.planned ? " · Dalam pengembangan" : ""}`
                    : undefined
                }
                onNavigate={() => onNavigate(item.href)}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="management-nav-text">{item.label}</span>
                {item.planned && (
                  <span className="management-nav-badge">Segera</span>
                )}
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
}

export function AppShell({ children, refreshSeconds }: { children: ReactNode; refreshSeconds: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [collapsed, setCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  useEffect(() => {
    let active = true;
    const refreshAppearance = async () => {
      try {
        const response = await fetch("/api/pengaturan", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.appearance) setAppearance(data.appearance);
      } catch { /* Retain the last known appearance while offline. */ }
    };
    void refreshAppearance();
    const timer = window.setInterval(refreshAppearance, Math.max(refreshSeconds, 60) * 1000);
    window.addEventListener("appearance-saved", refreshAppearance);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("appearance-saved", refreshAppearance); };
  }, [refreshSeconds]);
  useEffect(() => { document.documentElement.dataset.theme = appearance.theme; }, [appearance.theme]);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let lastRefresh = Date.now();
    const interval = refreshSeconds * 1000;
    function refreshIfDue() {
      const active = document.activeElement;
      const editing = active instanceof HTMLElement && (active.matches("input, textarea, select, [contenteditable='true']") || active.isContentEditable);
      if (!shouldRefreshData(Date.now(), lastRefresh, interval, document.visibilityState === "visible", editing, Boolean(document.querySelector('[role="dialog"], dialog[open]')))) return;
      lastRefresh = Date.now();
      router.refresh();
    }
    const timer = window.setInterval(refreshIfDue, Math.min(interval, 5000));
    document.addEventListener("visibilitychange", refreshIfDue);
    window.addEventListener("focus", refreshIfDue);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfDue);
      window.removeEventListener("focus", refreshIfDue);
    };
  }, [refreshSeconds, router]);
  function navigate() {
    drawer.current?.close();
  }
  const current = managementNavigation
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "children" in item ? [...item.children] : [item],
      ),
    )
    .find(
      (item) =>
        item.href === pathname ||
        (item.href === "/petak" && (pathname.startsWith("/petak/") || pathname === "/spk")),
    );
  const brand = (
    <div className="management-brand">
      <span className="management-brand-icon">
        <Image src="/icon.svg" width={30} height={30} alt="" />
      </span>
      <div className="management-brand-copy">
        <strong>{appearance.name}</strong>
        <span>Management System</span>
      </div>
    </div>
  );
  return (
    <div className={`management-shell${collapsed ? " is-collapsed" : ""}`}>
      <aside className="management-sidebar" aria-label="Sidebar navigasi">
        <div className="management-sidebar-head">
          {brand}
          <button
            type="button"
            className="management-icon-button management-collapse"
            aria-label={collapsed ? "Perluas sidebar" : "Ringkas sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
        </div>
        <Navigation
          key={pathname}
          pathname={pathname}
          search={search}
          collapsed={collapsed}
          onNavigate={navigate}
        />
        <div className="management-sidebar-foot">
          <span className="management-foot-dot" />
          <span>Excavator · NasLabs</span>
        </div>
      </aside>
      <div className="management-workspace">
        <header className="management-topbar">
          <button
            type="button"
            className="management-icon-button management-menu"
            aria-label="Buka navigasi"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={21} />
          </button>
          <div className="management-topbar-copy">
            <span>NASLABS / EXCAVATOR</span>
            <strong>{current?.label ?? "Monitoring"}</strong>
          </div>
        </header>
        {children}
      </div>
      <dialog
        ref={drawer}
        className="management-drawer"
        aria-label="Navigasi utama"
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
      >
        <div className="management-drawer-head">
          {brand}
          <button
            type="button"
            className="management-icon-button"
            aria-label="Tutup navigasi"
            onClick={() => drawer.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <Navigation
          key={pathname}
          pathname={pathname}
          search={search}
          collapsed={false}
          onNavigate={navigate}
        />
      </dialog>

    </div>
  );
}
