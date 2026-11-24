const variants: Record<string, string> = {
  "Mulai pengerjaan": "started",
  "Dalam pengerjaan": "progress",
  Selesai: "complete",
};

export function ActivityStatus({ status }: { status: string }) {
  const variant = Object.hasOwn(variants, status) ? variants[status] : "other";
  return <span className="activity-status" data-status={variant}>{status || "Belum diketahui"}</span>;
}
