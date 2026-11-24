"use client";

import { Toast } from "@base-ui/react/toast";
import { useRouter } from "next/navigation";
import { formatDate } from "@/features/dashboard/lib/format";
import { deletePlotActivity } from "../actions/save-plot";
import type { PlotActivity } from "../lib/plot-activity-edit";
import { PlotActionDialog } from "./plot-action-dialog";

export function DeleteActivityDialog({ code, activity, onClose }: {
  code: string;
  activity: PlotActivity;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const date = activity.date ? formatDate(activity.date, { day: "numeric", month: "long", year: "numeric" }) : "Tanggal belum tercatat";
  return <PlotActionDialog title="Hapus aktivitas?"
    description={`Petak ${code} · ${date} · baris ${activity.sourceRow}. Catatan ini akan dihapus dari riwayat operasional.`}
    actionLabel="Hapus aktivitas" destructive onClose={onClose}
    onConfirm={async () => {
      const result = await deletePlotActivity({ code, sourceRow: activity.sourceRow, snapshot: JSON.stringify(activity) });
      if (result.ok) {
        toast.add({ title: result.message, type: "success" });
        onClose();
        router.refresh();
      }
      return result;
    }} />;
}
