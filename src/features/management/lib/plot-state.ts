import { createHash } from "node:crypto";
import type { ValidatedOverviewRecord, WorkStatus } from "../../dashboard/types";
import { deriveWorkStatus } from "../../dashboard/lib/derive-work-status";
import { validDate } from "../../dashboard/lib/normalize-overview";

export function legacyPlotRouteId(plotCode: string): string {
  const key = plotCode.trim().toLocaleUpperCase("id-ID");
  return `legacy_${createHash("sha256").update(`plot:v1:${key}`).digest("base64url")}`;
}

export function derivePlotState(rows: readonly ValidatedOverviewRecord[], sheetOrderConfirmed = false) {
  const eligible = rows.filter(({ record, duplicateOf }) => duplicateOf === null && record.plotCode);
  const dated = eligible.map(({ record }) => record).filter((record) => validDate(record.date));
  const latestStatus = deriveWorkStatus(dated, sheetOrderConfirmed);
  const starts = dated.filter((record) => record.workStatus === "Mulai pengerjaan").map((record) => record.date!).sort();
  const latestActivityDate = dated.map((record) => record.date!).sort().at(-1) ?? null;
  const completionDate = latestStatus.status === "Selesai" && !latestStatus.ambiguous
    ? dated.filter((record) => record.workStatus === "Selesai").map((record) => record.date!).sort().at(-1) ?? null
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
