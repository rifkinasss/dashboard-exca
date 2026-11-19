import "server-only";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { buildManagementDirectory } from "../../lib/build-management-directory";
import { plotWorksheetName, readPlotSheet } from "./plot-sheet-source";
import { safeSyncError } from "@/features/dashboard/data/server/sync-error";

export async function getPlotDirectoryData() {
  const source = await getDashboardData();
  if (source.kind === "error") return { kind: "error" as const, status: source.status };
  if (source.status.source === "mock") return { kind: "demo" as const, status: source.status };
  let sheetPlots: Awaited<ReturnType<typeof readPlotSheet>> = [];
  const worksheet = plotWorksheetName(process.env);
  if (worksheet) {
    try { sheetPlots = await readPlotSheet(); }
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
