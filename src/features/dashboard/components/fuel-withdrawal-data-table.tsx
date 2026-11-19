"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { FuelActionPreview } from "./fuel-action-preview";
import { FuelWithdrawalForm } from "./fuel-withdrawal-form";
import { formatDate, formatNumber } from "../lib/format";
import { resolveWithdrawalPricing, type FuelPriceCatalog } from "../lib/fuel-price";
import type { FuelWithdrawal } from "../lib/fuel-withdrawals";

const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(amount);

export function FuelWithdrawalDataTable({ rows, total, page, setPage, priceCatalog, hasFilters, resetFilters, authReady, writerReady, userEmail, plotCodes }: { rows: FuelWithdrawal[]; total: number; page: number; setPage: (page: number) => void; priceCatalog: FuelPriceCatalog | null; hasFilters: boolean; resetFilters: () => void; authReady: boolean; writerReady: boolean; userEmail: string | null; plotCodes: string[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [detail, setDetail] = useState<FuelWithdrawal | null>(null);
  const [previewAction, setPreviewAction] = useState<{ record: FuelWithdrawal; action: "edit" | "archive" } | null>(null);
  const pricingCell = (row: FuelWithdrawal, field: "price" | "cost") => {
    const pricing = resolveWithdrawalPricing(row, priceCatalog);
    const value = pricing[field];
    return value !== null ? <>{rupiah(value)}{pricing.kind === "estimated" && (field === "price" ? <span className="fuel-estimate-label">Estimasi</span> : <span className="sr-only"> (estimasi)</span>)}</> : pricing.kind === "review" ? "Perlu tinjauan" : "Belum tersedia";
  };
  const columns: ColumnDef<FuelWithdrawal>[] = [
    { accessorKey: "date", header: "Tanggal pengambilan", cell: ({ row }) => formatDate(row.original.date, { day: "numeric", month: "short", year: "numeric" }) },
    { accessorKey: "plotCode", header: "Kode petak", cell: ({ row }) => <span className="fuel-plot-code">{row.original.plotCode}</span> },
    { accessorKey: "liters", header: "Solar (L)", cell: ({ row }) => `${formatNumber(row.original.liters)} L`, meta: { numeric: true } },
    { id: "price", accessorFn: (row) => resolveWithdrawalPricing(row, priceCatalog).price ?? undefined, header: "Harga / L", sortUndefined: "last", cell: ({ row }) => pricingCell(row.original, "price"), meta: { numeric: true } },
    { id: "cost", accessorFn: (row) => resolveWithdrawalPricing(row, priceCatalog).cost ?? undefined, header: "Biaya solar", sortUndefined: "last", cell: ({ row }) => pricingCell(row.original, "cost"), meta: { numeric: true } },
    { id: "actions", header: "Aksi", enableSorting: false, cell: ({ row }) => <div className="fuel-actions"><Button variant="outline" size="sm" onClick={() => setDetail(row.original)} aria-label={`Lihat detail pembelian ${row.original.plotCode} tanggal ${row.original.date}`}><Eye data-icon="inline-start" aria-hidden="true" />Detail</Button></div> },
  ];
  const pageIndex = Math.min(page - 1, Math.max(0, Math.ceil(rows.length / 10) - 1));
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, state: { sorting, pagination: { pageIndex, pageSize: 10 } }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), getRowId: (row) => String(row.sourceRow) });

  return <section className="directory-table-panel fuel-table-panel" aria-label="Daftar pembelian solar">
    <div className="fuel-table-scroll" role="region" aria-label="Tabel pembelian solar, geser untuk melihat seluruh kolom" tabIndex={0}><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => {
      const direction = header.column.getIsSorted();
      const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
      const numeric = (header.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
      return <TableHead key={header.id} className={header.id === "actions" ? "fuel-actions-heading" : numeric ? "fuel-numeric" : undefined} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>{header.column.getCanSort() ? <button type="button" className="directory-sort" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<Icon size={13} aria-hidden="true" /></button> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>;
    })}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={(cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric ? "fuel-numeric" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></div>
    {!rows.length && <div className="directory-empty"><strong>{total ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi pengambilan"}</strong><p>{total ? "Ubah pencarian atau rentang tanggal." : "Transaksi yang tersedia akan tampil di sini."}</p>{total > 0 && hasFilters && <Button variant="outline" size="sm" onClick={resetFilters}>Reset filter</Button>}</div>}
    <footer className="fuel-pagination"><span>Halaman {pageIndex + 1} dari {Math.max(1, table.getPageCount())} <span aria-hidden="true">·</span> {rows.length} transaksi</span><div><Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => setPage(pageIndex)}><ChevronLeft data-icon="inline-start" aria-hidden="true" />Sebelumnya</Button><Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => setPage(pageIndex + 2)}>Berikutnya<ChevronRight data-icon="inline-end" aria-hidden="true" /></Button></div></footer>
    {previewAction && (previewAction.action === "edit" ? <FuelWithdrawalForm record={previewAction.record} plotCodes={plotCodes} priceCatalog={priceCatalog} authReady={authReady} writerReady={writerReady} userEmail={userEmail} onClose={() => setPreviewAction(null)} /> : <FuelActionPreview item={{ kind: "purchase", record: previewAction.record }} action="archive" onClose={() => setPreviewAction(null)} />)}
    <Sheet open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null); }}><SheetContent><div className="p-6 space-y-6"><SheetTitle className="text-xl font-semibold">Detail pembelian solar</SheetTitle><SheetDescription>Rincian transaksi berdasarkan data yang tersedia.</SheetDescription>{detail && <dl className="space-y-4"><div><dt>Tanggal pengambilan</dt><dd className="font-semibold">{formatDate(detail.date, { day: "numeric", month: "long", year: "numeric" })}</dd></div><div><dt>Kode petak</dt><dd className="font-semibold">{detail.plotCode}</dd></div><div><dt>Jumlah solar</dt><dd className="font-semibold">{formatNumber(detail.liters)} L</dd></div><div><dt>Harga per liter</dt><dd className="font-semibold">{pricingCell(detail, "price")}</dd></div><div><dt>Biaya solar</dt><dd className="font-semibold">{pricingCell(detail, "cost")}</dd></div></dl>}{detail && <div className="fuel-actions fuel-detail-actions"><Button variant="outline" size="sm" className="fuel-action-edit" onClick={() => { setPreviewAction({ record: detail, action: "edit" }); setDetail(null); }}><Pencil data-icon="inline-start" aria-hidden="true" />Edit</Button><Button variant="outline" size="sm" className="fuel-action-archive" onClick={() => { setPreviewAction({ record: detail, action: "archive" }); setDetail(null); }}><Trash2 data-icon="inline-start" aria-hidden="true" />Arsipkan</Button><SheetClose render={<Button size="sm" variant="outline" />}>Tutup</SheetClose></div>}</div></SheetContent></Sheet>
  </section>;
}
