"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Banknote, ChevronDown, ClipboardList, Eye, Fuel, RotateCcw, Search } from "lucide-react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/features/dashboard/lib/format";
import { calculateTwoPercentTax } from "@/features/shared/tax";
import type { FinanceRecord } from "../types";

const currency = (value: number | null) => value === null ? "Belum tersedia" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(value);

export function FinanceRecordDirectory({ records }: { records: FinanceRecord[] }) {
  const [query, setQuery] = useState("");
  const [plot, setPlot] = useState("");
  const [spk, setSpk] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "plot", desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [selected, setSelected] = useState<FinanceRecord | null>(null);
  const plotCodes = useMemo(() => [...new Set(records.flatMap((row) => row.plot ? [row.plot] : []))].sort(), [records]);
  const spkNumbers = useMemo(() => [...new Set(records.flatMap((row) => row.spk ? [row.spk] : []))].sort(), [records]);
  const visible = useMemo(() => records.filter((row) => (!plot || row.plot === plot) && (!spk || row.spk === spk) && `${row.plot ?? ""} ${row.spk ?? ""}`.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID"))), [records, plot, spk, query]);
  const sumSnapshot = (values: (number | null)[]) => values.length && values.every((value): value is number => value !== null && Number.isFinite(value)) ? values.reduce((sum, value) => sum + value, 0) : null;
  const afterTaxCount = visible.filter((row) => row.grossValue !== null).length;
  const costCount = visible.filter((row) => row.fuelCost !== null).length;
  const afterTax = calculateTwoPercentTax(sumSnapshot(visible.map((row) => row.grossValue)))?.afterTax ?? null;
  const fuelCost = sumSnapshot(visible.map((row) => row.fuelCost));
  const update = (setter: (value: string) => void, value: string) => { setter(value); setPagination((current) => ({ ...current, pageIndex: 0 })); };
  const reset = () => { setQuery(""); setPlot(""); setSpk(""); setPagination((current) => ({ ...current, pageIndex: 0 })); };
  const columns: ColumnDef<FinanceRecord>[] = [
    { id: "spk", accessorFn: (row) => row.spk ?? undefined, header: "Nomor SPK", cell: ({ row }) => row.original.spk ?? "Belum tersedia", sortUndefined: "last" },
    { id: "plot", accessorFn: (row) => row.plot ?? undefined, header: "Kode petak", cell: ({ row }) => <strong>{row.original.plot ?? "Belum tersedia"}</strong>, sortUndefined: "last" },
    { id: "area", accessorFn: (row) => row.area ?? undefined, header: "Luas", cell: ({ row }) => row.original.area === null ? "—" : `${formatNumber(row.original.area)} Ha`, sortUndefined: "last" },
    { id: "grossValue", accessorFn: (row) => row.grossValue ?? undefined, header: "Pendapatan kotor", cell: ({ row }) => currency(row.original.grossValue), sortUndefined: "last" },
    { id: "afterTax", accessorFn: (row) => calculateTwoPercentTax(row.grossValue)?.afterTax, header: "Setelah pajak 2%", cell: ({ row }) => currency(calculateTwoPercentTax(row.original.grossValue)?.afterTax ?? null), sortUndefined: "last" },
    { id: "fuelCost", accessorFn: (row) => row.fuelCost ?? undefined, header: "Biaya solar", cell: ({ row }) => currency(row.original.fuelCost), sortUndefined: "last" },
    { id: "actions", header: "Aksi", enableSorting: false, cell: ({ row }) => <div className="directory-row-actions"><Button size="sm" variant="outline" className="plot-detail-link" onClick={() => setSelected(row.original)} aria-label={`Lihat detail keuangan ${row.original.plot ?? "petak belum diketahui"}, SPK ${row.original.spk ?? "belum tersedia"}`}><Eye data-icon="inline-start" aria-hidden="true" />Lihat detail</Button></div> },
  ];
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: visible, columns, state: { sorting, pagination }, onSortingChange: setSorting, onPaginationChange: setPagination, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), getRowId: (row) => `${row.worksheet}-${row.row}` });

  return <main className="directory-page activity-page finance-record-page">
    <header className="activity-heading"><div><span className="directory-eyebrow">RINGKASAN</span><h1>Data Keuangan</h1><p>Ringkasan nilai keuangan per SPK dan petak lahan.</p></div></header>
    <section className="activity-summary" aria-label="Ringkasan hasil filter">
      <div><span className="activity-summary-icon"><ClipboardList aria-hidden="true" /></span><span><small>Catatan keuangan</small><strong>{visible.length}</strong><em>Snapshot sesuai filter</em></span></div>
      <div><span className="activity-summary-icon"><Banknote aria-hidden="true" /></span><span><small>Total setelah pajak 2%</small><strong>{currency(afterTax)}</strong><em>{afterTaxCount} dari {visible.length} snapshot sumber</em></span></div>
      <div><span className="activity-summary-icon"><Fuel aria-hidden="true" /></span><span><small>Total biaya solar</small><strong>{currency(fuelCost)}</strong><em>{costCount} dari {visible.length} snapshot sumber</em></span></div>
    </section>
    <section className="activity-list"><div className="activity-list-heading"><div><h2>Daftar keuangan</h2><p>Nilai merupakan snapshot per SPK dan petak, bukan transaksi bertanggal.</p></div><span>{visible.length} catatan</span></div>
      <div className="finance-record-filters">
        <label className="activity-search">Pencarian<div><Search aria-hidden="true" /><Input value={query} onChange={(event) => update(setQuery, event.target.value)} placeholder="Cari SPK atau kode petak" /></div></label>
        <label>Kode petak
          <span className="finance-filter-select">
            <select value={plot} onChange={(event) => update(setPlot, event.target.value)}>
              <option value="">Semua petak</option>
              {plotCodes.map((code) => <option key={code}>{code}</option>)}
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>
        <label>Nomor SPK
          <span className="finance-filter-select">
            <select value={spk} onChange={(event) => update(setSpk, event.target.value)}>
              <option value="">Semua SPK</option>
              {spkNumbers.map((number) => <option key={number}>{number}</option>)}
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>
        <Button variant="outline" onClick={reset} disabled={!query && !plot && !spk}><RotateCcw data-icon="inline-start" aria-hidden="true" />Reset</Button>
      </div>
      <div className="directory-table-panel activity-table"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => { const direction = header.column.getIsSorted(); const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown; return <TableHead key={header.id} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>{header.column.getCanSort() ? <button type="button" className="directory-sort" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<Icon size={13} aria-hidden="true" /></button> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>; })}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table>
        {!visible.length && <div className="directory-empty"><strong>{records.length ? "Tidak ada data yang cocok" : "Belum ada data keuangan"}</strong><p>{records.length ? "Ubah pencarian atau filter." : "Data keuangan yang tersedia akan tampil di sini."}</p></div>}
        <footer className="directory-pagination"><span>Halaman {pagination.pageIndex + 1} dari {Math.max(1, table.getPageCount())} · {visible.length} catatan</span><div><Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Berikutnya</Button></div></footer>
      </div>
      <p className="finance-record-note">Nilai setelah pajak dihitung dari pendapatan kotor sumber. Biaya solar mengikuti snapshot keuangan.</p>
    </section>
    {selected && <FinanceRecordDetail row={selected} onClose={() => setSelected(null)} />}
  </main>;
}

function FinanceRecordDetail({ row, onClose }: { row: FinanceRecord; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tax = calculateTwoPercentTax(row.grossValue);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="directory-drawer activity-detail" aria-labelledby="finance-record-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="directory-drawer-panel"><header><div><span className="directory-eyebrow">RINCIAN KEUANGAN</span><h2 id="finance-record-title">{row.plot ?? "Petak belum diketahui"}</h2><p className="activity-detail-date">SPK {row.spk ?? "belum tersedia"} · Snapshot tanpa tanggal transaksi</p></div><Button variant="outline" onClick={onClose}>Tutup</Button></header>
    <section className="activity-detail-section"><h3>Nilai petak</h3><dl><div><dt>Luas petak</dt><dd>{row.area === null ? "Belum tersedia" : `${formatNumber(row.area)} Ha`}</dd></div><div><dt>Harga per hektar</dt><dd>{currency(row.pricePerHa)}</dd></div><div><dt>Harga per petak</dt><dd>{currency(row.pricePerPlot)}</dd></div><div><dt>Pendapatan kotor</dt><dd>{currency(row.grossValue)}</dd></div><div><dt>Potongan pajak 2%</dt><dd>{currency(tax?.tax ?? null)}</dd></div><div><dt>Setelah pajak 2%</dt><dd>{currency(tax?.afterTax ?? null)}</dd></div></dl></section>
    <section className="activity-detail-section"><h3>Solar</h3><dl><div><dt>Harga per liter</dt><dd>{currency(row.fuelPrice)}</dd></div><div><dt>Volume solar</dt><dd>{row.fuelRefill === null ? "Belum tersedia" : `${formatNumber(row.fuelRefill)} L`}</dd></div><div><dt>Total biaya solar</dt><dd>{currency(row.fuelCost)}</dd></div></dl></section>
    <section className="activity-detail-section"><h3>Nilai lainnya</h3><dl><div><dt>Pendapatan bersih pada sumber</dt><dd>{currency(row.sourceNetValue)}</dd></div></dl><p className="finance-record-note">Nilai ini mengikuti sumber dan belum tentu mencakup seluruh biaya.</p></section>
  </section></dialog>;
}
