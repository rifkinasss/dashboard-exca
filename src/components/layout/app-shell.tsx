"use client";

import { BrandIcon } from "@/components/brand-icon";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Fuel,
  LayoutDashboard,
  Map,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { shouldRefreshData } from "@/features/shared/lib/auto-refresh";
import { buttonForeground, defaultAppearance, isHexColor, secondaryChartColor, type Appearance } from "@/features/settings/lib/appearance";
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

let sessionDarkMode = false;
function readColorMode() {
  try { return localStorage.getItem("excavator-color-mode") === "dark"; }
  catch { return sessionDarkMode; }
}
function subscribeColorMode(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("color-mode-changed", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("color-mode-changed", callback); };
}

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

export function AppShell({ children, refreshSeconds, releaseVersion }: { children: ReactNode; refreshSeconds: number; releaseVersion?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [collapsed, setCollapsed] = useState(false);
  const darkMode = useSyncExternalStore(subscribeColorMode, readColorMode, () => false);
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  useEffect(() => {
    document.documentElement.dataset.colorMode = darkMode ? "dark" : "light";
  }, [darkMode]);
  function toggleColorMode() {
    const next = !darkMode;
    sessionDarkMode = next;
    try { localStorage.setItem("excavator-color-mode", next ? "dark" : "light"); } catch { /* Session-only preference. */ }
    window.dispatchEvent(new Event("color-mode-changed"));
  }
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
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--chart-secondary", secondaryChartColor(appearance.theme));
    if (isHexColor(appearance.theme)) {
      root.dataset.theme = "custom";
      root.style.setProperty("--primary", appearance.theme);
      root.style.setProperty("--primary-hover", `color-mix(in srgb, ${appearance.theme}, black 25%)`);
      root.style.setProperty("--primary-soft", `color-mix(in srgb, ${appearance.theme}, var(--surface) 90%)`);
      root.style.setProperty("--ring", appearance.theme);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(appearance.theme.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      root.style.setProperty("--primary-foreground", 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#0F172A" : "#fff");
      root.style.setProperty("--button-primary-foreground", buttonForeground(appearance.theme));
    } else {
      root.dataset.theme = appearance.theme;
      ["--primary", "--primary-hover", "--primary-soft", "--ring", "--primary-foreground", "--button-primary-foreground"].forEach((property) => root.style.removeProperty(property));
    }
  }, [appearance.theme]);
  useEffect(() => {
    const icon = document.querySelector<SVGSVGElement>("[data-brand-icon]");
    if (!icon) return;
    const copy = icon.cloneNode(true) as SVGSVGElement;
    const style = getComputedStyle(icon);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("style", `color:${style.color}`);
    copy.querySelector("rect")?.setAttribute("fill", getComputedStyle(icon.querySelector("rect")!).fill);
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [appearance.theme, darkMode, pathname]);
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
    .find((item) => item.href === pathname);
  const pageTitle = pathname === "/spk" ? "Data SPK"
    : pathname.startsWith("/petak/") ? "Detail Petak"
    : pathname === dashboardPaths.operasional ? "Dashboard Operasional"
    : pathname === dashboardPaths.keuangan ? "Dashboard Keuangan"
    : current?.label ?? "Monitoring";
  const brand = (
    <div className="management-brand">
      <span className="management-brand-icon">
        <BrandIcon />
      </span>
      <div className="management-brand-copy">
        <strong>{appearance.name}</strong>
        {releaseVersion && <span>Versi {releaseVersion}</span>}
      </div>
    </div>
  );
  if (pathname === "/login") return children;
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
            <span>{appearance.name}</span>
            <strong>{pageTitle}</strong>
          </div>
          <button type="button" className="management-mode-toggle" onClick={toggleColorMode} aria-label={darkMode ? "Aktifkan tema terang" : "Aktifkan tema gelap"} title={darkMode ? "Tema terang" : "Tema gelap"}>
            {darkMode ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          </button>
          <AccountMenu />
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
