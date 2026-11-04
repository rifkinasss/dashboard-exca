import { Skeleton } from "@/components/ui/skeleton";

type LoadingLayout = "dashboard" | "directory" | "detail" | "settings" | "solar";

export function DashboardLoading({ layout = "dashboard", section = "operasional" }: { section?: "operasional" | "keuangan"; layout?: LoadingLayout }) {
  const dashboard = layout === "dashboard";
  const settings = layout === "settings";
  return <main className="page-skeleton" role="status" aria-live="polite" aria-label="Memuat halaman">
    <span className="sr-only">Memuat halaman…</span>
    <div aria-hidden="true" className="page-skeleton-content">
      <div className="page-skeleton-heading"><Skeleton className="page-skeleton-title" /><Skeleton className="page-skeleton-subtitle" /></div>
      {dashboard && <div className="page-skeleton-panel page-skeleton-filters">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="page-skeleton-input" />)}</div>}
      {!settings && <div className="page-skeleton-cards">{Array.from({ length: dashboard ? (section === "keuangan" ? 5 : 6) : layout === "detail" ? 4 : 3 }, (_, i) => <div className="page-skeleton-panel page-skeleton-card" key={i}><Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-card-value" /><Skeleton className="page-skeleton-card-note" /></div>)}</div>}
      {settings ? <><div className="page-skeleton-panel page-skeleton-settings"><Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-input" /><Skeleton className="page-skeleton-input" /></div><div className="page-skeleton-charts">{[0, 1].map(i => <div className="page-skeleton-panel page-skeleton-card" key={i}><Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-card-value" /></div>)}</div></> : dashboard ? <div className="page-skeleton-charts">{[0, 1, 2, 3].map(i => <div className="page-skeleton-panel page-skeleton-chart" key={i}><Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-chart-body" /></div>)}</div> : <div className="page-skeleton-panel page-skeleton-table"><Skeleton className="page-skeleton-input" />{Array.from({ length: 5 }, (_, i) => <Skeleton className="page-skeleton-table-row" key={i} />)}</div>}
    </div>
  </main>;
}
