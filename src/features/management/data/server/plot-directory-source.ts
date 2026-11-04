import "server-only";
import { getDashboardData } from "@/features/dashboard/data/server/dashboard-source";
import { buildManagementDirectory } from "../../lib/build-management-directory";

export async function getPlotDirectoryData() {
  const source = await getDashboardData();
  if (source.kind === "error") return { kind: "error" as const, status: source.status };
  if (source.status.source === "mock") return { kind: "demo" as const, status: source.status };
  return {
    kind: "ready" as const,
    status: source.status,
    data: buildManagementDirectory(source.rows, [], {
      operationWorksheet: source.status.worksheet ?? "Overview Operasional",
      operationSpkMerges: source.spkMerges,
      operationPlotMerges: source.plotCodeMerges,
    }),
  };
}
