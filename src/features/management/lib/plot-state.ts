import { createHash } from "node:crypto";
import type { ValidatedOverviewRecord, WorkStatus } from "../../dashboard/types";
import { deriveWorkStatus } from "../../dashboard/lib/derive-work-status";
import { normalizeWorkStatus, validDate } from "../../dashboard/lib/normalize-overview";
import type { SheetPlot } from "./plot-sheet";

export function legacyPlotRouteId(plotCode: string): string {
  const key = plotCode.trim().toLocaleUpperCase("id-ID");
  return `legacy_${createHash("sha256").update(`plot:v1:${key}`).digest("base64url")}`;
}

export function derivePlotState(rows: readonly ValidatedOverviewRecord[], sheetOrderConfirmed = false, blockActivities: readonly Pick<SheetPlot["activities"][number], "date" | "workStatus" | "sourceRow">[] = []) {
  const eligible = rows.filter(({ record, duplicateOf }) => duplicateOf === null && record.plotCode);
  const dated = eligible.map(({ record }) => record).filter((record) => validDate(record.date));
  const statusRows = [
    ...dated,
    ...blockActivities.filter((activity) => validDate(activity.date)).map((activity) => {
      const parsedStatus = normalizeWorkStatus(activity.workStatus);
      return {
        date: activity.date!,
        workStatus: parsedStatus.state === "valid" ? parsedStatus.value : null,
        source: { worksheet: "Okt 2026 - testing", row: activity.sourceRow },
      };
    }),
  ];
  const latestStatus = deriveWorkStatus(statusRows, sheetOrderConfirmed);
  const starts = statusRows.filter((record) => record.workStatus === "Mulai pengerjaan").map((record) => record.date!).sort();
  const latestActivityDate = statusRows.map((record) => record.date!).sort().at(-1) ?? null;
  const completionDate = latestStatus.status === "Selesai" && !latestStatus.ambiguous
    ? statusRows.filter((record) => record.workStatus === "Selesai").map((record) => record.date!).sort().at(-1) ?? null
    : null;

  return {
    status: latestStatus.status,
    statusAmbiguous: latestStatus.ambiguous,
    startDate: starts[0] ?? null,
    completionDate,
    latestActivityDate,
    startEventCount: starts.length,
  } satisfies { status: WorkStatus | null; statusAmbiguous: boolean; startDate: string | null; completionDate: string | null; latestActivityDate: string | null; startEventCount: number };
}
