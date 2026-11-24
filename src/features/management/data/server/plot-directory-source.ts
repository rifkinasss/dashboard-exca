import "server-only";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { buildManagementDirectory } from "../../lib/build-management-directory";
import { parseOperationalPlots, plotWorksheetName, readPlotSheetRows } from "./plot-sheet-source";
import { mapPlot2026Overview } from "@/features/dashboard/data/server/google-sheets";
import { plot2026Worksheet } from "../../lib/plot-sheet";
import { safeSyncError } from "@/features/dashboard/data/server/sync-error";

export async function getAnnualPlotSource() {
  const worksheet = plotWorksheetName(process.env);
  if (worksheet !== plot2026Worksheet || process.env.DASHBOARD_DATA_SOURCE?.trim() !== "google-sheets") return null;
  const now = new Date().toISOString();
  const status = { source: "google-sheets" as const, worksheet, evaluatedAt: now, ttlSeconds: Number(process.env.SHEETS_CACHE_TTL_SECONDS ?? 60) };
  try {
    const values = await readPlotSheetRows();
    return {
      kind: "ready" as const,
      status: { ...status, state: "connected" as const, lastSuccessAt: now, error: null },
      rows: mapPlot2026Overview({ values }, true),
      sheetPlots: parseOperationalPlots(values, worksheet),
      spkMerges: [],
      plotCodeMerges: [],
    };
  } catch (error) {
    return { kind: "error" as const, status: { ...status, state: "failed" as const, lastSuccessAt: null, error: safeSyncError(error) } };
  }
}

export async function getPlotDirectoryData() {
  const annual = await getAnnualPlotSource();
  if (annual?.kind === "error") return annual;
  if (annual?.kind === "ready") return {
    kind: "ready" as const,
    status: annual.status,
    data: buildManagementDirectory(annual.rows, [], {
      operationWorksheet: annual.status.worksheet,
      sheetPlotWorksheet: annual.status.worksheet,
      sheetPlots: annual.sheetPlots,
    }),
  };

  const worksheet = plotWorksheetName(process.env);
  const source = await getDashboardData();
  if (source.kind === "error") return { kind: "error" as const, status: source.status };
  if (source.status.source === "mock") return { kind: "demo" as const, status: source.status };
  let sheetPlots: ReturnType<typeof parseOperationalPlots> = [];
  if (worksheet) {
    try { sheetPlots = parseOperationalPlots(await readPlotSheetRows(), worksheet); }
    catch (error) { return { kind: "error" as const, status: { ...source.status, state: "failed" as const, worksheet, error: safeSyncError(error) } }; }
  }
  return {
    kind: "ready" as const,
    status: { ...source.status, worksheet: worksheet ?? source.status.worksheet },
    data: buildManagementDirectory(source.rows, [], {
      operationWorksheet: source.status.worksheet ?? "Overview Operasional",
      operationSpkMerges: source.spkMerges,
      operationPlotMerges: source.plotCodeMerges,
      sheetPlots,
      sheetPlotWorksheet: worksheet ?? undefined,
    }),
  };
}
