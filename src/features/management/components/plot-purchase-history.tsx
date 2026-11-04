import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/features/dashboard/lib/format";
import { resolveWithdrawalPricing, type FuelPriceCatalog } from "@/features/dashboard/lib/fuel-price";
import type { FuelWithdrawal } from "@/features/dashboard/lib/fuel-withdrawals";

const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(amount);

export function PlotPurchaseHistory({ records, available, invalidRows, priceCatalog }: { records: FuelWithdrawal[]; available: boolean; invalidRows: number; priceCatalog: FuelPriceCatalog | null }) {
  return <section aria-label="Riwayat pembelian solar">
    <div className="plot-panel-heading"><div><h2>Riwayat pembelian solar</h2><p>Transaksi dengan kode petak yang sama, dari tanggal terbaru.</p></div></div>
    <p className="management-form-hint">Harga dan biaya yang belum tercatat dihitung sebagai estimasi dari harga yang disetujui dan berlaku pada tanggal transaksi.</p>
    {invalidRows > 0 && <p className="directory-notice" role="status">{invalidRows} baris sumber pembelian tidak valid dan belum dapat dikaitkan ke petak.</p>}
    <div className="directory-table-panel plot-history-table plot-purchase-table">
      <Table><TableHeader><TableRow><TableHead>Tanggal pembelian</TableHead><TableHead>Solar (L)</TableHead><TableHead>Harga per liter</TableHead><TableHead>Biaya solar</TableHead></TableRow></TableHeader>
        <TableBody>{records.map((record) => {
          const pricing = resolveWithdrawalPricing(record, priceCatalog);
          const missing = pricing.kind === "review" ? "Perlu tinjauan" : "Belum tersedia";
          return <TableRow key={record.sourceRow}><TableCell>{formatDate(record.date, { day: "numeric", month: "short", year: "numeric" })}</TableCell><TableCell>{formatNumber(record.liters)} L</TableCell><TableCell>{pricing.price === null ? missing : <>{rupiah(pricing.price)}{pricing.kind === "estimated" && <span className="fuel-estimate-label">Estimasi</span>}</>}</TableCell><TableCell>{pricing.cost === null ? missing : <>{rupiah(pricing.cost)}{pricing.kind === "estimated" && <span className="fuel-estimate-label">Estimasi</span>}</>}</TableCell></TableRow>;
        })}</TableBody>
      </Table>
      {!records.length && <div className="directory-empty"><strong>{available ? "Belum ada transaksi yang cocok" : "Data pembelian belum tersedia"}</strong><p>{available ? "Tidak ditemukan transaksi dengan kode petak ini." : "Sumber pembelian belum dapat dibaca. Muat ulang halaman untuk mencoba lagi."}</p></div>}
    </div>
  </section>;
}
