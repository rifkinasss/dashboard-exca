import { RotateCcw, SlidersHorizontal, CalendarDays, ListChecks, Settings, ChevronDown, Database, Clock3 } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { workStatuses, type DashboardFilters } from "../types";

export function Filters({ value, plotCodes, onChange, onReset, isDemo }: { value: DashboardFilters; plotCodes: string[]; onChange: (value: DashboardFilters) => void; onReset: () => void; isDemo: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const filterStatuses: DashboardFilters["statuses"] = workStatuses.filter((status) => status !== "Belum mulai" && status !== "Ditunda");
  const previousStatuses = value.statuses.filter((status) => !filterStatuses.includes(status));
  const invalidRange = Boolean(value.startDate && value.endDate && value.startDate > value.endDate);
  function toggle<T extends string>(values: T[], item: T) {
    return values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
  }
  return <aside className={`filter-sidebar${expanded ? " filters-expanded" : ""}`} aria-label="Filter dashboard"><div className="filter-disclosure">
    <h2 className="filter-title"><SlidersHorizontal size={17} aria-hidden="true" /> FILTER DATA</h2>
    <button className="filter-toggle" aria-expanded={expanded} aria-controls="filter-content" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={17} aria-hidden="true" /> FILTER DATA <span className="filter-chevron" aria-hidden="true">⌄</span></button>
    <div className="filter-content" id="filter-content"><p className="filter-intro">Atur cakupan data yang ditampilkan.</p>
      <fieldset className="date-fields"><legend><span className="filter-legend"><CalendarDays size={20} aria-hidden="true" /> Tanggal</span><span>WITA</span></legend>
        <label htmlFor="start-date">Tanggal mulai</label><Input id="start-date" type="date" value={value.startDate} aria-invalid={invalidRange} aria-describedby={invalidRange ? "date-error" : undefined} onChange={(event) => onChange({ ...value, startDate: event.target.value })} />
        <label htmlFor="end-date">Tanggal akhir</label><Input id="end-date" type="date" value={value.endDate} aria-invalid={invalidRange} aria-describedby={invalidRange ? "date-error" : undefined} onChange={(event) => onChange({ ...value, endDate: event.target.value })} />
        {invalidRange && <p id="date-error" className="field-error" role="alert">Tanggal akhir harus sama atau setelah tanggal mulai.</p>}
      </fieldset>
      <fieldset><legend><span className="filter-legend"><ListChecks size={20} aria-hidden="true" /> Kode Petak</span><span>{value.plotCodes.length || "Semua"}</span></legend><details className="plot-dropdown"><summary><span>{value.plotCodes.length ? `${value.plotCodes.length} petak dipilih` : "Semua kode petak"}</span><ChevronDown size={16} aria-hidden="true" /></summary><div className="plot-options">{plotCodes.map((code) => <label className="check-option" key={code}><Checkbox checked={value.plotCodes.includes(code)} onCheckedChange={() => onChange({ ...value, plotCodes: toggle(value.plotCodes, code) })} /><span>{code}</span></label>)}</div></details></fieldset>
      <fieldset><legend><span className="filter-legend"><Settings size={20} aria-hidden="true" /> Status Pekerjaan</span></legend>{filterStatuses.map((status) => <label className="check-option" key={status}><Checkbox checked={value.statuses.includes(status)} onCheckedChange={() => onChange({ ...value, statuses: toggle(value.statuses, status) })} /><span>{status}</span></label>)}{previousStatuses.length > 0 && <p className="field-hint">Filter lama aktif: {previousStatuses.join(", ")}. <button type="button" className="detail-action" onClick={() => onChange({ ...value, statuses: value.statuses.filter((status) => filterStatuses.includes(status)) })}>Hapus filter lama</button></p>}<p className="field-hint">Status terakhir tiap petak dalam rentang tanggal.</p></fieldset>
      <Button variant="outline" className="reset-button" onClick={onReset}><RotateCcw size={15} aria-hidden="true" /> Reset filter</Button>
    </div></div><section className="source-note" aria-label="Tentang data">
      <h2 className="source-note-title">Tentang data</h2>
      <div className="source-meta-item"><Database aria-hidden="true" /><div><span>Sumber data</span><strong>{isDemo ? "Data demo" : "Google Sheets"}</strong></div></div>
      <div className="source-meta-item"><Clock3 aria-hidden="true" /><div><span>Zona waktu</span><strong>Asia/Makassar · WITA</strong></div></div>
      <p className="source-note-description">{isDemo ? "Data sintetis, bukan pengukuran lapangan." : "Metadata petak dan aktivitas periode ditampilkan terpisah."}</p>
      <div className="source-note-credit"><span>Dibuat oleh</span><strong>NasLabs</strong></div>
    </section></aside>;
}
