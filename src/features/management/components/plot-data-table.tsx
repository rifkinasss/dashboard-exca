"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Plus, Search } from "lucide-react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/features/dashboard/lib/format";
import type { buildManagementDirectory } from "../lib/build-management-directory";

type Directory = ReturnType<typeof buildManagementDirectory>;
type Plot = Directory["plots"][number];

export function PlotDataTable({ data, onAdd }: { data: Directory; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [spk, setSpk] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "code", desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("id-ID");
    return data.plots.filter((plot) => {
      const text = [plot.code, ...plot.spks, plot.status ?? "", ...plot.issues.map((issue) => issue.message)].join(" ").toLocaleLowerCase("id-ID");
      if (term && !text.includes(term)) return false;
      if (status === "unknown" && (plot.status !== null || plot.statusAmbiguous)) return false;
      if (!["all", "unknown"].includes(status) && plot.status !== status) return false;
      if (spk === "linked" && !plot.spks.length) return false;
      if (spk === "pending" && plot.spks.length) return false;
      return true;
    });
  }, [data.plots, query, status, spk]);
  const columns = useMemo<ColumnDef<Plot>[]>(() => [
    { accessorKey: "code", header: "Kode petak", cell: ({ row }) => <span className="directory-primary-cell"><Link href={`/petak/${row.original.id}`}>{row.original.code}</Link></span> },
    { id: "spk", accessorFn: (plot) => plot.spks.join(", "), header: "No. SPK", cell: ({ getValue }) => String(getValue() || "—") },
    { accessorKey: "area", header: "Luas (Ha)", cell: ({ row }) => row.original.area === null ? "—" : formatNumber(row.original.area) },
    { id: "status", accessorFn: (plot) => plot.statusAmbiguous ? "Perlu tinjauan" : plot.status ?? "Belum diketahui", header: "Status terakhir" },
    { accessorKey: "startDate", header: "Tanggal mulai", cell: ({ row }) => row.original.startDate ? formatDate(row.original.startDate) : "—" },
    { accessorKey: "completionDate", header: "Tanggal selesai", cell: ({ row }) => row.original.completionDate ? formatDate(row.original.completionDate) : "—" },
    { accessorKey: "hours", header: "HM (Jam)", cell: ({ row }) => formatNumber(row.original.hours) },
    { accessorKey: "refill", header: "Pengisian solar (L)", cell: ({ row }) => formatNumber(row.original.refill) },
    { accessorKey: "efficiency", header: "Rata-rata konsumsi (L/jam)", cell: ({ row }) => formatNumber(row.original.efficiency) },
    { id: "actions", header: "Aksi", enableSorting: false, cell: ({ row }) => <div className="directory-row-actions"><Link href={`/petak/${row.original.id}`} aria-label={`Lihat detail petak ${row.original.code}`} className={buttonVariants({ variant: "outline", size: "sm", className: "plot-detail-link" })}>Lihat detail <ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link></div> },
  ], []);
  // TanStack's mutable table instance is consumed only in this component, not memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, state: { sorting, pagination }, onSortingChange: setSorting, onPaginationChange: setPagination, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), getRowId: (row) => row.id });
  function resetPage() { setPagination((current) => ({ ...current, pageIndex: 0 })); }

  return <>
    <section className="directory-toolbar plot-filter-toolbar" aria-label="Cari dan filter data petak">
      <label className="plot-filter-search">Pencarian<div><Search size={16} aria-hidden="true" /><Input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Cari kode petak atau SPK" /></div></label>
      <label className="directory-filter">Status<select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="all">Semua</option><option>Belum mulai</option><option>Mulai pengerjaan</option><option>Dalam pengerjaan</option><option>Selesai</option><option>Ditunda</option><option value="unknown">Belum diketahui</option></select></label>
      <label className="directory-filter">SPK<select value={spk} onChange={(event) => { setSpk(event.target.value); resetPage(); }}><option value="all">Semua petak</option><option value="linked">Dengan SPK</option><option value="pending">Tanpa SPK</option></select></label>
      <div className="plot-filter-actions"><Button size="sm" onClick={onAdd}><Plus data-icon="inline-start" aria-hidden="true" />Tambah petak</Button></div>
    </section>
    <section className="directory-table-panel" aria-label="Daftar petak">
      <Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => {
        const direction = header.column.getIsSorted();
        const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
        return <TableHead key={header.id} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>{header.column.getCanSort() ? <button type="button" className="directory-sort" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<Icon size={13} aria-hidden="true" /></button> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>;
      })}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table>
      {!rows.length && <div className="directory-empty"><strong>{data.plots.length ? "Tidak ada data yang cocok" : "Belum ada data untuk ditampilkan"}</strong><p>{data.plots.length ? "Ubah kata pencarian atau filter." : "Daftar hanya memuat data sumber Google Sheets yang berhasil dinormalisasi."}</p></div>}
      <footer className="directory-pagination"><span>Halaman {table.getState().pagination.pageIndex + 1} dari {Math.max(1, table.getPageCount())} · {rows.length} entri</span><div><Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Berikutnya</Button></div></footer>
    </section>
  </>;
}
