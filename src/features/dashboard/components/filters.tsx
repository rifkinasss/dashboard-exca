import { RotateCcw, SlidersHorizontal, CalendarDays, ListChecks, Settings, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { workStatuses, type DashboardFilters } from "../types";

export function Filters({ value, plotCodes, onChange, onReset, isDemo }: { value: DashboardFilters; plotCodes: string[]; onChange: (value: DashboardFilters) => void; onReset: () => void; isDemo: boolean }) {
  const [expanded, setExpanded] = useState(false);
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
      <fieldset><legend><span className="filter-legend"><Settings size={20} aria-hidden="true" /> Status Pekerjaan</span></legend>{workStatuses.map((status) => <label className="check-option" key={status}><Checkbox checked={value.statuses.includes(status)} onCheckedChange={() => onChange({ ...value, statuses: toggle(value.statuses, status) })} /><span>{status}</span></label>)}<p className="field-hint">Status terakhir tiap petak dalam rentang tanggal.</p></fieldset>
      <Button variant="outline" className="reset-button" onClick={onReset}><RotateCcw size={15} aria-hidden="true" /> Reset filter</Button>
    </div></div><div className="source-note"><strong>Tentang data</strong><p>{isDemo ? "Dataset demo Oktober 2026. Seluruh angka bersifat sintetis dan bukan pengukuran lapangan." : "Data berasal dari Google Sheets. Metadata petak dan aktivitas periode ditampilkan terpisah."}</p><span>Zona waktu Asia/Makassar</span><p>Dibuat oleh <strong>NasLabs</strong></p></div></aside>;
}
