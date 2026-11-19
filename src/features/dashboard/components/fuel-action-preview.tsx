"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { DraftModal } from "@/features/management/components/draft-modal";
import type { FuelPriceRecord } from "../lib/fuel-price";
import type { FuelWithdrawal } from "../lib/fuel-withdrawals";

type Preview = { kind: "purchase"; record: FuelWithdrawal } | { kind: "price"; record: FuelPriceRecord };

export function FuelActionPreview({ item, action, onClose }: { item: Preview; action: "edit" | "archive"; onClose: () => void }) {
  const isPurchase = item.kind === "purchase";
  const [date, setDate] = useState(isPurchase ? item.record.date : item.record.effectiveDate);
  const [amount, setAmount] = useState(String(isPurchase ? item.record.liters : item.record.rupiahPerLiter));
  const [plot, setPlot] = useState(isPurchase ? item.record.plotCode : "");
  const [note, setNote] = useState(isPurchase ? "" : item.record.note);
  const title = `${action === "edit" ? "Edit" : "Arsipkan"} ${isPurchase ? "pembelian" : "harga"} solar`;
  return <DraftModal className="fuel-withdrawal-dialog fuel-price-dialog" title={title} description="Pratinjau tampilan tindakan." dirty={false} onClose={onClose} onReset={() => { setDate(isPurchase ? item.record.date : item.record.effectiveDate); setAmount(String(isPurchase ? item.record.liters : item.record.rupiahPerLiter)); setPlot(isPurchase ? item.record.plotCode : ""); setNote(isPurchase ? "" : item.record.note); }}>
    <Alert><AlertDescription>Mode pratinjau. {action === "archive" ? "Pengarsipan" : "Penyimpanan perubahan"} belum tersedia; data Google Sheets tidak diubah.</AlertDescription></Alert>
    <div className="management-form-grid mt-4">
      <label><span>{isPurchase ? "Tanggal pengambilan" : "Tanggal berlaku"}</span><Input type="date" value={date} disabled={action === "archive"} onChange={(event) => setDate(event.target.value)} /></label>
      {isPurchase && <label><span>Kode petak</span><Input value={plot} disabled={action === "archive"} onChange={(event) => setPlot(event.target.value)} /></label>}
      <label><span>{isPurchase ? "Jumlah solar (L)" : "Harga per liter (Rp)"}</span><Input inputMode="decimal" value={amount} disabled={action === "archive"} onChange={(event) => setAmount(event.target.value)} /></label>
      {!isPurchase && <label><span>Keterangan</span><Input value={note} disabled={action === "archive"} onChange={(event) => setNote(event.target.value)} /></label>}
    </div>
  </DraftModal>;
}
