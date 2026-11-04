"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ManagedRecord } from "./record-directory";

const detail = (row: ManagedRecord, name: string) => row.details.find(([label]) => label === name)?.[1] || "—";
const dateLabel = (date: string) => date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "—";

export function ActivityDataTable({ rows, page, onPageChange, onDetail }: { rows: ManagedRecord[]; page: number; onPageChange: (page: number) => void; onDetail: (row: ManagedRecord) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const columns: ColumnDef<ManagedRecord>[] = [
    { accessorKey: "date", header: "Tanggal", cell: ({ row }) => dateLabel(row.original.date) },
    { accessorKey: "plot", header: "Kode petak", cell: ({ row }) => <span className="directory-primary-cell">{row.original.plotId ? <Link href={`/petak/${row.original.plotId}`}>{row.original.plot}</Link> : row.original.plot || "Belum diketahui"}{row.original.spk && <span className="directory-secondary-line">SPK {row.original.spk}</span>}</span> },
    { accessorKey: "status", header: "Status pekerjaan", cell: ({ row }) => <span className="activity-status" data-status={row.original.status === "Selesai" ? "complete" : row.original.status === "Dalam pengerjaan" ? "progress" : "other"}>{row.original.status || "Belum diketahui"}</span> },
    { id: "meters", header: "HM awal / akhir", enableSorting: false, cell: ({ row }) => <>{detail(row.original, "HM awal")} / {detail(row.original, "HM akhir")}</> },
    { id: "hours", header: "HM kerja", enableSorting: false, cell: ({ row }) => <>{detail(row.original, "HM kerja")}{detail(row.original, "HM kerja") !== "—" && " jam"}</> },
    { id: "fuel", header: "Pengisian solar", enableSorting: false, cell: ({ row }) => <>{detail(row.original, "Pengisian solar")}{detail(row.original, "Pengisian solar") !== "—" && " L"}</> },
    { id: "actions", header: "Aksi", enableSorting: false, cell: ({ row }) => <div className="directory-row-actions"><Button size="sm" variant="outline" className="plot-detail-link" aria-label={`Lihat detail aktivitas ${row.original.plot || "petak"}${row.original.date ? `, ${dateLabel(row.original.date)}` : ""}`} onClick={() => onDetail(row.original)}><Eye data-icon="inline-start" aria-hidden="true" />Lihat detail</Button></div> },
  ];
  const pageIndex = Math.min(page - 1, Math.max(0, Math.ceil(rows.length / 10) - 1));
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, state: { sorting, pagination: { pageIndex, pageSize: 10 } }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), getRowId: (row) => row.key });

  return <div className="directory-table-panel activity-table"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => {
    const direction = header.column.getIsSorted();
    const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
    return <TableHead key={header.id} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>{header.column.getCanSort() ? <button type="button" className="directory-sort" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<Icon size={13} aria-hidden="true" /></button> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>;
  })}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table>
    {!rows.length && <div className="directory-empty"><strong>Tidak ada aktivitas yang cocok</strong><p>Coba ubah pencarian atau filter.</p></div>}
    <footer className="directory-pagination"><span>Halaman {pageIndex + 1} dari {Math.max(1, table.getPageCount())} · {rows.length} catatan</span><div><Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => onPageChange(pageIndex)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => onPageChange(pageIndex + 2)}>Berikutnya</Button></div></footer>
  </div>;
}
