"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Database, Fuel, Info, Palette, ShieldCheck, Target, Cloud } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { id: "identitas", label: "Identitas aplikasi", icon: Palette },
  { id: "sumber", label: "Sumber data", icon: Database },
  { id: "akses", label: "Hak akses", icon: ShieldCheck },
  { id: "drive", label: "Google Drive", icon: Cloud },
  { id: "target", label: "Target operasional", icon: Target },
  { id: "harga", label: "Harga acuan", icon: Fuel },
  { id: "tentang", label: "Tentang aplikasi", icon: Info },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function SettingsTabs({ panels }: { panels: Record<TabId, ReactNode> }) {
  return <Tabs.Root defaultValue="identitas" className="settings-tabs">
    <Tabs.List className="settings-tabs-list" aria-label="Kategori pengaturan">
      {tabs.map(({ id, label, icon: Icon }) => <Tabs.Tab key={id} value={id} className="settings-tab"><Icon size={17} aria-hidden="true" />{label}</Tabs.Tab>)}
    </Tabs.List>
    {tabs.map(({ id }) => <Tabs.Panel key={id} value={id} keepMounted className="settings-tab-panel">{panels[id]}</Tabs.Panel>)}
  </Tabs.Root>;
}
