"use client";

import { useState } from "react";
import { Check, ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "../lib/format";
import { countActiveFilters, getPeriodValue, periodRange } from "../lib/filter-toolbar-state";
import type { DashboardFilters, WorkStatus } from "../types";

type Props = {
  value: DashboardFilters;
  plotCodes: string[];
  spkOptions: { number: string; plots: string[] }[];
  periods: string[];
  initialFilters: DashboardFilters;
  onChange: (value: DashboardFilters) => void;
  onReset: () => void;
  isDemo: boolean;
};

const visibleStatuses: WorkStatus[] = ["Mulai pengerjaan", "Dalam pengerjaan", "Selesai"];
const cloneFilters = (value: DashboardFilters): DashboardFilters => ({ ...value, plotCodes: [...value.plotCodes], selectedSpkNumbers: [...value.selectedSpkNumbers], statuses: [...value.statuses] });

export function Filters({ value, plotCodes, spkOptions, periods, initialFilters, onChange, onReset, isDemo }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => cloneFilters(value));
  const [spkQuery, setSpkQuery] = useState("");
  const [plotQuery, setPlotQuery] = useState("");
  const invalidRange = Boolean(value.startDate && value.endDate && value.startDate > value.endDate);
  const draftInvalidRange = Boolean(draft.startDate && draft.endDate && draft.startDate > draft.endDate);
  const activeCount = countActiveFilters(value);

  function editDraft(next: Partial<DashboardFilters>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function editQuick(next: Partial<DashboardFilters>) {
    onChange({ ...value, ...next });
  }

  function applyPeriod(period: string, apply: (next: Partial<DashboardFilters>) => void) {
    const range = periodRange(period);
    if (range) apply(range);
  }

  function openSheet() {
    setDraft(cloneFilters(value));
    setSpkQuery("");
    setPlotQuery("");
    setOpen(true);
  }

  function resetDraft() {
    setDraft(cloneFilters(initialFilters));
    setSpkQuery("");
    setPlotQuery("");
  }

  function activeChips() {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (value.startDate || value.endDate) chips.push({ key: "date", label: `Tanggal: ${value.startDate ? formatDate(value.startDate, { day: "numeric", month: "short", year: "numeric" }) : "awal"} – ${value.endDate ? formatDate(value.endDate, { day: "numeric", month: "short", year: "numeric" }) : "akhir"}`, clear: () => editQuick({ startDate: "", endDate: "" }) });
    value.selectedSpkNumbers.forEach((number) => chips.push({ key: `spk-${number}`, label: `SPK ${number}`, clear: () => editQuick({ selectedSpkNumbers: value.selectedSpkNumbers.filter((item) => item !== number) }) }));
    value.plotCodes.forEach((code) => chips.push({ key: `plot-${code}`, label: code, clear: () => editQuick({ plotCodes: value.plotCodes.filter((item) => item !== code) }) }));
    value.statuses.forEach((status) => chips.push({ key: `status-${status}`, label: status, clear: () => editQuick({ statuses: value.statuses.filter((item) => item !== status) }) }));
    return chips;
  }

  const chips = activeChips();

  return <section className="filter-toolbar" aria-label="Filter dashboard operasional">
    <div className="filter-toolbar-row">
      <label className="quick-filter quick-date"><span>Tanggal awal</span><Input type="date" value={value.startDate} max={value.endDate || undefined} aria-invalid={invalidRange} onChange={(event) => editQuick({ startDate: event.target.value })} /></label>
      <label className="quick-filter quick-date"><span>Tanggal akhir</span><Input type="date" value={value.endDate} min={value.startDate || undefined} aria-invalid={invalidRange} onChange={(event) => editQuick({ endDate: event.target.value })} /></label>
      <MultiSelect label="Nomor SPK" summary={value.selectedSpkNumbers.length ? `${value.selectedSpkNumbers.length} dipilih` : "Semua SPK"} options={spkOptions.map(({ number, plots }) => ({ value: number, description: plots.join(", ") }))} selected={value.selectedSpkNumbers} onChange={(selected) => editQuick({ selectedSpkNumbers: selected })} query={spkQuery} onQueryChange={setSpkQuery} searchLabel="Cari nomor SPK atau kode petak" emptyText="Tidak ada SPK yang cocok." icon="spk" />
      <MultiSelect label="Kode Petak" summary={value.plotCodes.length ? `${value.plotCodes.length} dipilih` : "Semua petak"} options={plotCodes.map((code) => ({ value: code }))} selected={value.plotCodes} onChange={(selected) => editQuick({ plotCodes: selected })} query={plotQuery} onQueryChange={setPlotQuery} searchLabel="Cari kode petak" emptyText="Tidak ada petak yang cocok." icon="plot" />
      <Button className="all-filters-trigger" variant="outline" onClick={openSheet}><SlidersHorizontal data-icon="inline-start" aria-hidden="true" />Semua Filter{activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}</Button>
    </div>
    <div className="active-filters" aria-live="polite" aria-label="Filter aktif">
      {chips.length ? <>{chips.map((chip) => <button type="button" className="active-filter-chip" key={chip.key} onClick={chip.clear} aria-label={`Hapus filter ${chip.label}`}>{chip.label}<X size={13} aria-hidden="true" /></button>)}<button type="button" className="clear-active-filters" onClick={onReset}>Reset semua</button></> : <span className="filter-scope-note">{isDemo ? "Mode demonstrasi · data sintetis" : "Tampilan seluruh data sesuai periode yang dipilih"}</span>}
      {invalidRange && <span className="filter-range-error" role="alert">Rentang tanggal tidak valid.</span>}
    </div>

    <Sheet open={open} onOpenChange={(nextOpen) => { if (nextOpen) setDraft(cloneFilters(value)); setOpen(nextOpen); }}>
      <SheetContent className="filter-sheet" aria-labelledby="filter-sheet-title" aria-describedby="filter-sheet-description">
        <header className="filter-sheet-header"><div><SheetTitle id="filter-sheet-title">Semua Filter</SheetTitle><SheetDescription id="filter-sheet-description">Atur periode dan cakupan aktivitas. Perubahan diterapkan setelah menekan Terapkan Filter.</SheetDescription></div><SheetClose render={<Button variant="ghost" size="icon" aria-label="Tutup filter"><X aria-hidden="true" /></Button>} /></header>
        <div className="filter-sheet-body">
        <fieldset className="filter-sheet-field"><legend>Periode cepat</legend><div className="filter-period-select"><select aria-label="Pilih periode" value={getPeriodValue(draft, periods)} onChange={(event) => applyPeriod(event.target.value, editDraft)}><option value="all">Semua tanggal</option>{[...periods].reverse().map((period) => <option key={period} value={period}>{formatDate(`${period}-01`, { month: "long", year: "numeric" })}</option>)}{getPeriodValue(draft, periods) === "custom" && <option value="custom" disabled>Rentang khusus</option>}</select><ChevronDown size={16} aria-hidden="true" /></div></fieldset>
          <fieldset className="filter-sheet-field"><legend>Rentang tanggal <span>WITA</span></legend><div className="filter-date-grid"><label>Tanggal mulai<Input type="date" value={draft.startDate} aria-invalid={draftInvalidRange} onChange={(event) => editDraft({ startDate: event.target.value })} /></label><label>Tanggal akhir<Input type="date" value={draft.endDate} aria-invalid={draftInvalidRange} onChange={(event) => editDraft({ endDate: event.target.value })} /></label></div>{draftInvalidRange && <p className="field-error" role="alert">Tanggal akhir harus sama atau setelah tanggal mulai.</p>}</fieldset>
          <MultiSelect label="Nomor SPK" summary={draft.selectedSpkNumbers.length ? `${draft.selectedSpkNumbers.length} dipilih` : "Semua SPK"} options={spkOptions.map(({ number, plots }) => ({ value: number, description: plots.join(", ") }))} selected={draft.selectedSpkNumbers} onChange={(selected) => editDraft({ selectedSpkNumbers: selected })} query={spkQuery} onQueryChange={setSpkQuery} searchLabel="Cari nomor SPK atau kode petak" emptyText="Tidak ada SPK yang cocok." icon="spk" />
          <MultiSelect label="Kode Petak" summary={draft.plotCodes.length ? `${draft.plotCodes.length} dipilih` : "Semua petak"} options={plotCodes.map((code) => ({ value: code }))} selected={draft.plotCodes} onChange={(selected) => editDraft({ plotCodes: selected })} query={plotQuery} onQueryChange={setPlotQuery} searchLabel="Cari kode petak" emptyText="Tidak ada petak yang cocok." icon="plot" />
          <fieldset className="filter-sheet-field"><legend>Status pekerjaan</legend><div className="filter-status-options">{visibleStatuses.map((status) => <CheckOption key={status} label={status} checked={draft.statuses.includes(status)} onChange={() => editDraft({ statuses: toggle(draft.statuses, status) })} />)}</div>{draft.statuses.some((status) => !visibleStatuses.includes(status)) && <p className="field-hint">Filter status lama masih aktif. Reset filter untuk menghapusnya.</p>}</fieldset>
        </div>
        <footer className="filter-sheet-footer"><Button variant="outline" onClick={resetDraft}><RotateCcw data-icon="inline-start" aria-hidden="true" />Reset Filter</Button><Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button><Button disabled={draftInvalidRange} onClick={() => { onChange(cloneFilters(draft)); setOpen(false); }}><Check data-icon="inline-start" aria-hidden="true" />Terapkan Filter</Button></footer>
      </SheetContent>
    </Sheet>
  </section>;
}

function MultiSelect({ label, summary, options, selected, onChange, query, onQueryChange, searchLabel, emptyText, icon }: {
  label: string;
  summary: string;
  options: { value: string; description?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  emptyText: string;
  icon: "spk" | "plot";
}) {
  const term = query.trim().toLocaleLowerCase("id-ID");
  const visible = options.filter(({ value, description = "" }) => `${value} ${description}`.toLocaleLowerCase("id-ID").includes(term));
  return <details className={`quick-filter quick-multiselect quick-multiselect-${icon}`} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === "Escape" && event.currentTarget.open) { event.stopPropagation(); event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
    <summary><span className="quick-multiselect-label">{label}</span><strong>{summary}</strong><ChevronDown size={15} aria-hidden="true" /></summary>
    <div className="quick-filter-menu"><label className="filter-search"><Search size={15} aria-hidden="true" /><Input type="search" aria-label={searchLabel} placeholder="Cari…" value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>
      {selected.length > 0 && <button type="button" className="clear-multi-filter" onClick={() => onChange([])}>Hapus pilihan</button>}
      <div className="quick-filter-options">{visible.length ? visible.map(({ value, description }) => <CheckOption key={value} label={value} description={description} checked={selected.includes(value)} onChange={() => onChange(toggle(selected, value))} />) : <p className="filter-empty-option" role="status">{emptyText}</p>}</div>
    </div>
  </details>;
}

function CheckOption({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: () => void }) {
  return <label className="filter-check-option"><Checkbox checked={checked} onCheckedChange={onChange} /><span>{label}{description && <small>{description}</small>}</span></label>;
}

function toggle<T extends string>(values: T[], item: T) { return values.includes(item) ? values.filter((value) => value !== item) : [...values, item]; }
