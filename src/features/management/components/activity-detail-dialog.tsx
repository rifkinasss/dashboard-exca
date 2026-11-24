"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/features/dashboard/lib/format";
import { ActivityStatus } from "./activity-status";
import type { ManagedRecord } from "./record-directory";

export function ActivityDetail({ row, close }: { row: Pick<ManagedRecord, "plot" | "plotId" | "date" | "status" | "spk" | "details" | "purchases">; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  const value = (name: string) => row.details.find(([label]) => label === name)?.[1] || "—";
  const date = row.date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.date}T00:00:00Z`)) : "Tanggal belum tersedia";
  const measurement = (name: string, unit: string) => value(name) === "—" ? "—" : `${value(name)} ${unit}`;
  return <dialog ref={dialog} className="directory-drawer activity-detail" aria-labelledby="activity-detail-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="directory-drawer-panel"><header><div><span className="directory-eyebrow">RINCIAN AKTIVITAS</span><h2 id="activity-detail-title">{row.plot || "Petak belum diketahui"}</h2><p className="activity-detail-date">{date}</p></div><Button variant="outline" onClick={close}>Tutup</Button></header>
      <div className="activity-detail-overview"><ActivityStatus status={row.status} /><span>SPK {row.spk || "belum tersedia"}</span></div>
      <section className="activity-detail-section"><h3>Jam kerja</h3><dl><div><dt>HM awal</dt><dd>{measurement("HM awal", "jam")}</dd></div><div><dt>HM akhir</dt><dd>{measurement("HM akhir", "jam")}</dd></div><div><dt>HM kerja</dt><dd>{measurement("HM kerja", "jam")}</dd></div><div><dt>Estimasi jam kerja</dt><dd>{measurement("Estimasi jam kerja", "jam")}</dd></div></dl></section>
      <section className="activity-detail-section"><h3>Solar</h3><dl><div><dt>Pengisian solar</dt><dd>{measurement("Pengisian solar", "L")}</dd></div><div><dt>Pemakaian solar riil</dt><dd>{measurement("Pemakaian solar riil", "L")}</dd></div><div><dt>Pemakaian solar per jam</dt><dd>{measurement("Pemakaian solar per jam", "L/jam")}</dd></div></dl></section>
      <section className="activity-detail-section"><h3>Pembelian solar</h3><p className="activity-purchase-note">Transaksi untuk petak dan tanggal yang sama; belum tentu terkait langsung dengan aktivitas ini.</p>{!row.date || !row.plot ? <p>Tanggal atau kode petak belum tersedia untuk mencocokkan pembelian.</p> : !row.purchases ? <p>Data pembelian belum tersedia.</p> : row.purchases.records.length === 0 ? <p>Tidak ada transaksi yang cocok pada tanggal ini.</p> : <div className="activity-purchase-list">{row.purchases.records.map(({ liters, pricing }, index) => <div key={index}><strong>{formatNumber(liters)} L</strong><span>Harga / L: {pricing.price === null ? pricing.kind === "review" ? "Perlu tinjauan" : "Belum tersedia" : `Rp ${formatNumber(pricing.price)}`}</span><span>Biaya: {pricing.cost === null ? pricing.kind === "review" ? "Perlu tinjauan" : "Belum tersedia" : `Rp ${formatNumber(pricing.cost)}`}{pricing.kind === "estimated" && " · Estimasi"}</span></div>)}</div>}{!!row.purchases?.invalidRows && <p className="activity-purchase-note">Sebagian baris pembelian tidak valid dan belum dapat dicocokkan.</p>}</section>
      <section className="activity-detail-section"><h3>Keterangan</h3><p>{value("Keterangan") === "—" ? "Tidak ada keterangan." : value("Keterangan")}</p></section>
      {row.plotId && <div className="activity-detail-footer"><Link href={`/petak/${row.plotId}`}>Lihat detail Petak Lahan <span aria-hidden="true">→</span></Link></div>}
    </section>
  </dialog>;
}
