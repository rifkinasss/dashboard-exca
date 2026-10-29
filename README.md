# Petak & Solar

Dashboard monitoring excavator, konsumsi solar, HM kerja, dan status petak. Layout Phase 1 serta engine/aturan Phase 2 dipertahankan. Phase 3 menambahkan adapter Google Sheets server-side dan cache 60 detik, dengan mode demo yang tetap eksplisit.

**Status: pembacaan live dan pipeline terverifikasi.** Worksheet `New Version Overview` memuat 30 baris sumber dengan 6 kode petak terdaftar. Sebanyak 22 aktivitas memiliki tanggal valid; 8 baris tanpa tanggal tidak masuk perhitungan aktivitas. Seluruh 15 header A–O cocok.

Periode awal adalah **Semua tanggal**: 5 petak memiliki aktivitas, sedangkan `45C/11` hanya memiliki baris tanpa tanggal. Oktober memiliki 5 petak aktif dan November 1. Metadata luas dan total solar kumulatif dikaitkan berdasarkan kode petak dengan referensi baris; solar kumulatif tidak dijumlahkan. Tiga label status sumber sudah dipetakan ke status mulai, berlangsung, dan selesai yang berbeda.

Pembacaan pada 30 Oktober 2026 menghasilkan 109 temuan: 11 error, 3 warning, dan 95 informasi. Ini mencakup 8 tanggal kosong, 3 stok tangki negatif, 2 luas nol yang perlu ditinjau, dan 1 petak tanpa aktivitas bertanggal. Lihat [laporan inventaris](docs/plot-inventory-2026-10-30.md) untuk cakupan dan perbandingan KPI.

## Menjalankan

```sh
npm ci
npm run dev
```

Buka http://localhost:3000. Kredensial hanya dibaca dari environment server. Enam variabel yang digunakan:

```text
GOOGLE_SPREADSHEET_ID
GOOGLE_SHEET_NAME
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
DASHBOARD_DATA_SOURCE=google-sheets atau mock
SHEETS_CACHE_TTL_SECONDS=60
```

Aktifkan Google Sheets API pada project service account dan beri akses Viewer ke spreadsheet. Restart setelah mengganti environment. Untuk mencoba read-only connection:

```sh
npm run verify:sheets
```

Perintah verifikasi hanya mencetak status tersanitasi dan agregat bila berhasil. Tidak ada credential/raw-row dump. Mode mock berisi 64 aktivitas sintetis pada delapan petak di Oktober 2026, bukan pengukuran spreadsheet.

Filter lokal memperbarui seluruh view dari snapshot yang sama tanpa fetch Google. Kualitas data tersedia di bawah tabel. Cache diperiksa kembali saat halaman dimuat setelah TTL; halaman terbuka tidak polling. Tidak ada tombol/endpoint manual refresh yang membypass cache.

Aplikasi belum memiliki autentikasi pengguna. Pengunjung yang dapat membuka halaman dapat menerima snapshot operasional A–O; lindungi akses aplikasi sebelum mempublikasikan data rahasia. Tidak ada endpoint API raw-data atau write ke spreadsheet.

## Dokumentasi

- [Kontrak dan aturan Phase 2](docs/phase-2-data-contract.md)
- [Integrasi Phase 3, hasil live, file, cache, keamanan dan batasnya](docs/phase-3-google-sheets-integration.md)
- [Inventaris petak, metadata, dan verifikasi 30 Oktober](docs/plot-inventory-2026-10-30.md)

## Validasi

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
```

Konfigurasi Webpack cadangan yang sudah ada menggunakan loader Tailwind yang sama.

| Pemeriksaan pada 30 Oktober 2026 | Hasil |
| --- | --- |
| `npm run verify:sheets` | PASS: read dan pipeline aktual |
| Metadata dan header worksheet | PASS: `New Version Overview`, 15/15 cocok |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 51 tes, 0 gagal |
| `npm run build -- --webpack` | PASS |
| `npm run build` Turbopack | Masih terhambat izin port worker CSS pada runtime ini |
| HTTP localhost:3000 | PASS: snapshot live 30 baris; enam KPI dan enam baris inventaris cocok dengan engine; pilihan periode tersedia |
| Kredensial dalam payload HTTP yang diperiksa | Tidak ditemukan kecocokan email/key yang diperiksa |
| Browser visual/mobile/hydration | NOT VERIFIED |

Verifikasi HTTP dan jalur data tidak dianggap sebagai pengujian visual/interaksi chart di browser. Rincian agregat per periode dan temuan kualitas sumber tersedia di laporan Phase 3.
