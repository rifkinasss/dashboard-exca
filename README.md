# Petak & Solar

Dashboard monitoring excavator, konsumsi solar, HM kerja, dan status petak. Layout Phase 1 serta engine/aturan Phase 2 dipertahankan. Phase 3 menambahkan adapter Google Sheets server-side dan cache 60 detik, dengan mode demo yang tetap eksplisit.

**Status: pembacaan live dan pipeline terverifikasi pada 31 Oktober 2026.** Worksheet yang dikonfigurasi saat verifikasi adalah `Overview Operasional`, dengan 16 header A–P termasuk `No. SPK` di kolom B. Dari 21 baris sumber, 20 aktivitas bertanggal diproses dan satu baris tanpa kode petak serta tanggal dikecualikan.

Lima kode petak terdeteksi. Kode petak pada kolom C yang kosong di dalam rentang merge vertikal dikenali hanya berdasarkan metadata merge Google Sheets; nilai mentah dan referensi ke sel asal tetap tersedia. No. SPK tidak diteruskan ke baris lain. Metadata luas dan total solar kumulatif dikaitkan berdasarkan kode petak; solar kumulatif tidak dijumlahkan. Tiga label status sumber dipetakan ke status mulai, berlangsung, dan selesai.

Pemeriksaan tersebut menghasilkan 17 temuan kualitas data: 6 error, 3 warning, dan 8 informasi. Angka merupakan snapshot saat verifikasi, bukan jaminan kondisi sumber selanjutnya. Laporan lama [30 Oktober](docs/plot-inventory-2026-10-30.md) menjelaskan kontrak sebelum penambahan No. SPK.

## Menjalankan

```sh
npm ci
npm run dev
```

Buka http://localhost:3000 untuk masuk ke `/dashboard/operasional`; `/dashboard/keuangan` menampilkan snapshot keuangan read-only dan aktivitas operasional; nilai snapshot keuangan tidak memiliki tanggal transaksi. Kredensial hanya dibaca dari environment server. Enam variabel yang digunakan:

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

Aplikasi belum memiliki autentikasi pengguna. Pengunjung yang dapat membuka halaman dapat menerima snapshot operasional A–P; lindungi akses aplikasi sebelum mempublikasikan data rahasia. Tidak ada endpoint API raw-data atau write ke spreadsheet.

## Dokumentasi

- [Kontrak dan aturan Phase 2](docs/phase-2-data-contract.md)
- [Integrasi Phase 3, hasil live, file, cache, keamanan dan batasnya](docs/phase-3-google-sheets-integration.md)
- [Inventaris petak, metadata, dan verifikasi 30 Oktober](docs/plot-inventory-2026-10-30.md)
- [Kontrak No. SPK dan merged cells, 31 Oktober](docs/google-sheets-spk-2026-10-31.md)
- [Target luas bulanan](docs/target-luas-bulanan.md)

## Validasi

Tabel berikut adalah hasil historis **30 Oktober 2026**, sebelum kolom No. SPK ditambahkan.

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
| Metadata dan header worksheet saat itu | PASS: `New Version Overview`, 15/15 cocok |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 51 tes, 0 gagal |
| `npm run build -- --webpack` | PASS |
| `npm run build` Turbopack | Masih terhambat izin port worker CSS pada runtime ini |
| HTTP localhost:3000 | PASS: snapshot live 30 baris; enam KPI dan enam baris inventaris cocok dengan engine; pilihan periode tersedia |
| Kredensial dalam payload HTTP yang diperiksa | Tidak ditemukan kecocokan email/key yang diperiksa |
| Browser visual/mobile/hydration | NOT VERIFIED |

Verifikasi HTTP dan jalur data tidak dianggap sebagai pengujian visual/interaksi chart di browser. Rincian agregat per periode dan temuan kualitas sumber tersedia di laporan Phase 3.
