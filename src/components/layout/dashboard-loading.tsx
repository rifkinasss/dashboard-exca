import { Skeleton } from "@/components/ui/skeleton";

const directoryLayouts = {
  activity: { cards: 3, grid: "activity-summary", filters: 5 },
  finance: { cards: 3, grid: "activity-summary", filters: 4 },
  plots: { cards: 4, grid: "plot-list-summary", filters: 2 },
  spk: { cards: 0, grid: "", filters: 2 },
  solar: { cards: 2, grid: "fuel-summary", filters: 3 },
  detail: { cards: 5, grid: "plot-summary-grid", filters: 0 },
};

export type LoadingLayout = keyof typeof directoryLayouts | "operational" | "finance-dashboard" | "settings" | "login" | "page";

function LoadingCards({ count, grid, card = "" }: { count: number; grid: string; card?: string }) {
  return <div className={grid}>
    {Array.from({ length: count }, (_, index) => <div className={`page-skeleton-panel page-skeleton-card ${card}`} key={index}>
      <Skeleton className="page-skeleton-card-label" />
      <Skeleton className="page-skeleton-card-value" />
      <Skeleton className="page-skeleton-card-note" />
    </div>)}
  </div>;
}

function LoadingInputs({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => <Skeleton key={index} className="page-skeleton-input" />);
}

export function OperationalChartPlaceholders() {
  return ["operational-consumption", "operational-trend", "fuel-variance", "", "", "fuel-comparison-chart"].map((chart, index) =>
    <div className={`panel chart-panel page-skeleton-panel page-skeleton-chart ${chart}`} key={index} aria-hidden="true">
      <Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-chart-body" />
    </div>,
  );
}

function LoadingTable({ className = "", filters = 0 }: { className?: string; filters?: number }) {
  return <div className={`page-skeleton-panel page-skeleton-table ${className}`}>
    <Skeleton className="page-skeleton-card-label" />
    {filters > 0 && <div className="page-skeleton-filters"><LoadingInputs count={filters} /></div>}
    {Array.from({ length: 5 }, (_, index) => <Skeleton className="page-skeleton-table-row" key={index} />)}
  </div>;
}

export function DashboardLoading({ layout = "page" }: { layout?: LoadingLayout }) {
  const directory = layout in directoryLayouts ? directoryLayouts[layout as keyof typeof directoryLayouts] : null;
  const pageClass = layout === "operational" ? "dashboard-shell"
    : layout === "finance-dashboard" ? "finance-main finance-dashboard-v2"
    : layout === "login" ? "access-page" : "";
  return <main className={`page-skeleton ${pageClass}`} role="status" aria-label="Memuat halaman">
    <div aria-hidden="true" className={`page-skeleton-content ${layout === "login" ? "access-card" : ""}`}>
      <div className="page-skeleton-heading"><Skeleton className="page-skeleton-title" /><Skeleton className="page-skeleton-subtitle" /></div>
      {layout === "operational" && <>
        <div className="filter-toolbar-row">
          {["quick-date", "quick-date", "quick-multiselect", "quick-multiselect"].map((filter, index) =>
            <div className={`quick-filter ${filter}`} key={index}><Skeleton className="page-skeleton-input" /></div>,
          )}
          <Skeleton className="page-skeleton-input all-filters-trigger" />
        </div>
        <Skeleton className="page-skeleton-card-label" />
        <LoadingCards count={6} grid="kpi-grid" card="kpi-card" />
        <div className="chart-grid"><OperationalChartPlaceholders /><LoadingTable className="summary-panel" /></div>
      </>}
      {layout === "finance-dashboard" && <div className="finance-layout">
        <div className="finance-filters finance-filter-panel"><div className="finance-filter-form"><LoadingInputs count={5} /></div></div>
        <div className="finance-content page-skeleton-content">
          <Skeleton className="page-skeleton-card-label" />
          <LoadingCards count={5} grid="finance-kpi-grid" />
          <div className="finance-chart-grid">{Array.from({ length: 4 }, (_, index) =>
            <div className="finance-panel page-skeleton-panel page-skeleton-chart" key={index}><Skeleton className="page-skeleton-card-label" /><Skeleton className="page-skeleton-chart-body" /></div>,
          )}</div>
          <LoadingTable />
        </div>
      </div>}
      {directory && <>
        {directory.cards > 0 && <LoadingCards count={directory.cards} grid={directory.grid} />}
        {layout === "detail" && <div className="page-skeleton-panel page-skeleton-settings"><LoadingInputs count={3} /></div>}
        {layout === "solar" && <div className="page-skeleton-panel"><Skeleton className="page-skeleton-card-label" /></div>}
        <LoadingTable filters={directory.filters} />
      </>}
      {layout === "settings" && <>
        <div className="settings-tabs-list page-skeleton-tabs"><LoadingInputs count={7} /></div>
        <div className="page-skeleton-panel page-skeleton-settings"><LoadingInputs count={3} /></div>
      </>}
      {layout === "login" && <Skeleton className="page-skeleton-input" />}
    </div>
  </main>;
}
