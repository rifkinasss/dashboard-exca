"use client";

import { useRouter } from "next/navigation";
import { Toast } from "@base-ui/react/toast";
import { deletePlot } from "../actions/save-plot";
import { PlotActionDialog } from "./plot-action-dialog";

export function DeletePlotDialog({ code, sourceRow, onClose }: {
  code: string;
  sourceRow: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  return <PlotActionDialog title={`Hapus petak ${code}?`}
    description="Data petak dan seluruh aktivitasnya akan dihapus. Transaksi pembelian solar dan dokumen SPK tetap tersimpan."
    actionLabel="Hapus petak" destructive onClose={onClose}
    onConfirm={async () => {
      const result = await deletePlot({ code, sourceRow });
      if (result.ok) {
        toast.add({ title: result.message, type: "success" });
        onClose();
        router.replace("/petak");
      }
      return result;
    }} />;
}
