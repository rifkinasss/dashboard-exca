# Phase 3: Google Sheets integration

> Dokumen ini mencatat kontrak dan pengujian sebelum penambahan No. SPK. Kontrak terbaru tersedia di [pembaruan 31 Oktober](google-sheets-spk-2026-10-31.md).

> Catatan historis: hasil dan perilaku periode/status di bawah mencatat verifikasi Phase 3 pada 29 Oktober 2026. Lihat [laporan inventaris terbaru](plot-inventory-2026-10-30.md) untuk perubahan dan verifikasi 30 Oktober.

Status terbaru: **live read, pipeline Phase 2, dan payload/SSR dashboard terverifikasi**. Google Sheets API sudah diaktifkan oleh pengguna. Verifikasi ini tidak mengubah business logic Phase 2 atau spreadsheet. Validasi visual/interaksi browser tetap belum dilakukan.

## Hasil pemeriksaan live pada 29 Oktober 2026

| Pemeriksaan | Hasil terbaru |
| --- | --- |
| Enam variabel konfigurasi | Tersedia; nilai kredensial tidak dicetak |
| Sumber aktif | `DASHBOARD_DATA_SOURCE=google-sheets` |
| Worksheet terkonfigurasi | `New Version Overview` |
| Nama worksheet lama | `Overview` tidak ditemukan; pengguna mengonfirmasi nama terbaru `New Version Overview` |
| TTL terkonfigurasi | 60 detik |
| Autentikasi | SUCCESS pada pemeriksaan OAuth `getAccessToken()` terakhir |
| Pembacaan metadata/worksheet melalui adapter | SUCCESS |
| Keberadaan spreadsheet/worksheet aktual | Terverifikasi melalui API |
| Header A–O | 15 header sesuai posisi; 0 mismatch |
| Locale sumber | `id_ID`; FORMATTED_VALUE cocok dengan parsing numerik/tanggal yang diuji |
| Timezone spreadsheet | `America/Los_Angeles`; date-only tetap dipertahankan, timestamp sinkronisasi ditampilkan WITA |
| Jumlah baris aktual | 30 setelah header, posisi sumber A2–O31 |
| Record eligible | 22 memiliki kode petak/tanggal yang dapat digunakan; bukan berarti bebas warning |
| Record dikecualikan | 8 baris tanpa tanggal |
| Baris dengan warning/error | 30; 0 baris sepenuhnya tanpa warning/error |
| KPI live dan quality warnings aktual | Terverifikasi melalui engine dan payload/SSR halaman |
| Source halaman | `google-sheets`, 30 raw rows; notice demo tidak ada |

Percobaan awal pernah terhenti pada autentikasi dan kemudian `SERVICE_DISABLED`. Setelah pengguna mengaktifkan API, pemeriksaan OAuth, metadata, values.get, dan pipeline aktual berhasil. Error lama tersebut sudah bukan status koneksi terbaru.

Tidak ada kredensial, private key, access token, ID spreadsheet, atau raw activity dump dalam laporan ini. Nama worksheet mengikuti klarifikasi pengguna, tanpa mengubah `.env.local`.

### Temuan kualitas data aktual

Total **168 temuan**: **138 informasi**, **22 warning**, **8 error**.

| Kode | Jumlah | Makna |
| --- | --- | --- |
| `missing_value` | 138 | Termasuk 8 tanggal kosong yang menjadi error; sisanya sel belum tersedia/informasi |
| `invalid_value` | 22 | Seluruhnya pada `workStatus`, karena label belum dikenali |
| `unpaired_measurements` | 8 | Informasi pada baris yang belum memiliki pasangan pengukuran |

Label status sumber: `Mulai Garap Petak` (5 aktivitas), `Garap Petak Berlangsung` (13), dan `Garap Petak Selesai` (4). Label ini tidak otomatis dipetakan ke enum Phase 2. Akibatnya, chart/table menampilkan **Belum diketahui**, dan filter status kanonis belum dapat mencocokkan label tersebut. Perubahan mapping memerlukan keputusan domain terpisah; tidak dilakukan dalam verifikasi ini.

### Agregat aktual dari engine yang sama

| Cakupan | Record eligible | Petak | Solar masuk L | Solar riil L | HM jam | L/jam |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Seluruh periode | 22 | 5 | 1.760 | 2.117,4 | 220 | 9,6 |
| Oktober 2026 | 19 | 5 | 1.760 | 1.661,4 | 175 | 9,5 |
| November 2026, default halaman | 3 | 1 | 0 | 456 | 45 | 10,1 |

Luas unik seluruh periode/Oktober adalah 37,9 ha. Luas dalam view November adalah null/N/A karena pengukuran C tidak tersedia di aktivitas periode tersebut; tidak diisi nol atau ditarik dari periode lain. Pembulatan angka tabel mengikuti formatter tampilan; engine memakai nilai numerik yang sama seperti Phase 2.

### Bukti penggunaan data live pada seluruh view

Respons HTTP localhost:3000 adalah 200. Payload RSC Dashboard berisi `source: google-sheets`, worksheet yang benar, dan 30 baris aktual, bukan fixture mock 64 baris. Initial filter adalah 1–30 November 2026. Lima nilai KPI SSR cocok dengan hasil `buildDashboardViewModel` yang dijalankan terhadap rows dan filter dari payload itu. Ringkasan tabel berisi 1 petak, sama dengan engine. Kelima bagian grafik dan disclosure kualitas data tersedia.

Penelusuran komponen memastikan `KpiCards`, `Charts` (seluruh lima chart), dan `PlotSummary` menerima objek `summary` yang sama dari pipeline terhadap `rows` live tersebut. Tidak ada kalkulasi atau mock provider terpisah pada masing-masing visualisasi. Ini verifikasi jalur data/SSR, bukan klaim bahwa tooltip, render SVG setelah hydration, atau layout mobile sudah diuji di browser.

## Arsitektur

`page.tsx` memakai Server Component dengan `connection()` dan Suspense. Pengambilan hanya berjalan saat permintaan halaman, bukan saat production build. Konfigurasi dan autentikasi dibatasi oleh `server-only`.

Aliran:

```text
.env.local / environment server
  → pemilihan sumber eksplisit
  → service account JWT, scope spreadsheets.readonly
  → metadata spreadsheet (locale, timezone, nama worksheet)
  → values.get pada '<worksheet>'!A:O, FORMATTED_VALUE, ROWS
  → validasi header dan bentuk baris
  → cache snapshot server
  → pipeline Phase 2 yang sama
  → KPI, grafik, tabel, dan kualitas data Phase 1/2
```

Tidak ada Google Sheets write request, database, autentikasi pengguna baru, endpoint raw-data, atau server action untuk refresh.

## Konfigurasi dan sumber

- `GOOGLE_SPREADSHEET_ID`: ID saja, bukan URL penuh.
- `GOOGLE_SHEET_NAME`: nama worksheet persis; konfigurasi saat pemeriksaan adalah `New Version Overview`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: hanya dipakai pada server.
- `GOOGLE_PRIVATE_KEY`: hanya dipakai pada server; literal `\n` dinormalisasi menjadi newline. Tidak dicetak atau diteruskan sebagai prop.
- `DASHBOARD_DATA_SOURCE`: wajib eksplisit `google-sheets` atau `mock`. Nilai kosong/tidak dikenal menghasilkan error konfigurasi, termasuk pada production.
- `SHEETS_CACHE_TTL_SECONDS`: bilangan bulat positif, default 60 bila tidak disediakan.

Mock tetap tersedia hanya ketika dipilih secara eksplisit. Kegagalan Google tidak pernah mengubah sumber menjadi mock. Default periode mock tetap Oktober 2026; live menggunakan bulan terbaru dengan kode petak dan tanggal valid dari engine Phase 2, sehingga tidak terjebak pada periode demo. Reset filter kembali ke periode awal snapshot live tersebut.

Nama worksheet provenance kini mengikuti sumber aktual melalui `ProcessingOptions.worksheetName`, dengan default `Overview` untuk fixture lama. Nomor baris tetap posisi fisik, header baris 1 dan aktivitas mulai baris 2. Kolom `No` tetap bukan identitas unik.

## Kontrak dan pemetaan

Urutan 15 kolom berasal dari `overviewColumns` Phase 2, tanpa salinan rumus atau definisi header baru. Header di baris pertama diperiksa per posisi A–O. Trim dan whitespace berulang diizinkan; perubahan ejaan/case, kolom hilang, atau urutan berbeda menghasilkan `headers_mismatch`. Adapter tidak mengurutkan ulang kolom.

Rentang A:O tidak memiliki batas baris tetap, sehingga baris yang ditambahkan akan terbaca pada sinkronisasi berikutnya. Sel trailing yang tidak dikembalikan API dipad dengan null hingga 15 kolom. Baris kosong di tengah tidak dibuang supaya nomor baris sumber tetap benar. Blank/partial rows tetap melewati QA Phase 2. Header saja atau worksheet yang seluruh baris aktivitasnya kosong menghasilkan `empty_worksheet`.

Bentuk respons non-array, sel object/array, dimensi selain ROWS, dan baris melebihi 15 kolom menghasilkan `malformed_response`. Nilai primitif yang salah format tetap diteruskan ke parser/quality diagnostics, bukan diubah menjadi nol.

`FORMATTED_VALUE` digunakan sejak awal. Metadata locale harus Indonesia (`id_ID`, `id-ID`, atau `id`) agar string seperti `1.460` tidak salah ditafsirkan sebagai 1460 pada sumber yang sebenarnya memakai titik desimal. Locale lain gagal jelas sebagai `source_format / UNSUPPORTED_LOCALE`; tidak ada penebakan locale atau fallback tersembunyi ke unformatted values/date serial. Sumber aktual terverifikasi memakai `id_ID`; tidak ditemukan invalid-value numerik/tanggal pada nilai yang terisi, sedangkan tanggal kosong dan label status tetap dilaporkan QA. Jika sumber membutuhkan pemetaan lain, tambahkan adapter berdasarkan contoh aktual dan pengujian, dengan engine Phase 2 tetap sama.

Seluruh aturan konflik luas/status, pairing H/L, duplikat, dan bidang yang dikecualikan tetap mengikuti [kontrak Phase 2](phase-2-data-contract.md). Tidak ada konfirmasi urutan entri sheet baru, perubahan toleransi HM, atau penggunaan D/K/M sebagai pengganti pengukuran.

## Cache dan status

Cache menyimpan snapshot yang berhasil dibaca dan lolos validasi struktur pada memori proses server. Sebelum TTL, semua permintaan memakai snapshot itu. Permintaan bersamaan dikoalesensikan menjadi satu load. Setelah TTL, permintaan halaman berikutnya mencoba membaca ulang; perubahan filter di React tidak menghubungi server/Google.

Jika refresh gagal, snapshot terakhir tetap dapat ditampilkan sebagai **stale**, disertai kegagalan dan waktu sukses asli. Kegagalan tidak memperbarui timestamp sukses. Jika belum pernah ada snapshot valid, halaman menampilkan error sinkronisasi, bukan KPI kosong atau data sintetis. Kegagalan juga memiliki cooldown sepanjang TTL agar permintaan ulang tidak langsung membanjiri Google.

Indikator menampilkan sumber, sinkronisasi sukses terakhir dalam WITA, stale, dan kegagalan yang disanitasi. Halaman yang dibiarkan terbuka menandai snapshot stale setelah TTL, tetapi tidak polling Google atau melakukan auto-refresh data. Reload halaman setelah TTL memicu pemeriksaan server berikutnya.

Batas: cache/cooldown bersifat per proses, hilang ketika restart/cold start, dan tidak merupakan rate limit global lintas instance. Snapshot stale bisa tetap ditampilkan sepanjang proses hidup sampai pembacaan berikutnya berhasil, dengan timestamp dan peringatan yang tetap terlihat. Jika deployment membutuhkan sinkronisasi lintas instance atau batas umur stale bisnis, tentukan kebijakan itu dan gunakan penyimpanan bersama.

Manual refresh button/API ditunda: belum ada autentikasi pengguna dan pembatasan permintaan lintas instance. Browser reload biasa tetap mengikuti cache/cooldown server; tidak ada endpoint publik untuk membypass cache.

## Kategori kegagalan

Konfigurasi, autentikasi/key invalid, spreadsheet tidak ditemukan, permission denied, API disabled, worksheet hilang, header berbeda, worksheet kosong, rate limit, gangguan jaringan/timeout, locale tidak cocok, respons malformed, dan gangguan upstream ditangani terpisah. Pesan dan next action berasal dari daftar statis. Error Google mentah, token, request headers, email, private key, dan stack tidak dikirim ke UI atau console aplikasi. Timeout transport 15 detik per request dan automatic retry transport dinonaktifkan; pembacaan berikutnya diatur cache/cooldown.

## Batas keamanan

Aplikasi **belum memiliki autentikasi pengguna**. Siapa pun yang dapat membuka dashboard dapat menerima snapshot operasional A–O melalui payload halaman/RSC untuk filter lokal dan rincian kualitas data, termasuk fields yang tidak menjadi KPI. Kontrol akses seluruh aplikasi diperlukan sebelum membuka data operasional yang bersifat rahasia ke publik.

Tidak ada unauthenticated API route yang mengekspor raw rows. Ini tidak membuat halaman publik menjadi privat. Kredensial hanya berada pada modul server; `source-types.ts` yang diimpor client hanya berisi tipe status yang aman. `.env.local` tetap diabaikan Git dan tidak diubah oleh implementasi.

Pemeriksaan produksi sebelumnya menemukan 0 kecocokan email service account dan fragmen key yang diperiksa pada 23 file client static. Pemeriksaan HTTP terbaru pada halaman dengan data live juga tidak menemukan kecocokan kredensial yang diperiksa dan tidak menampilkan notice demo. Ini pemeriksaan payload HTTP, bukan validasi visual/hydration/browser lengkap.

## File dan paket

Ditambahkan:

- `data/source-types.ts`
- `data/server/config.ts`, `sync-error.ts`, `google-sheets.ts`, `dashboard-source.ts`
- `components/source-status.tsx`
- `tests/google-sheets.test.ts`
- `scripts/verify-sheets.mjs`
- Dokumen ini.

Diubah: `src/app/page.tsx`, metadata `layout.tsx`, `components/dashboard.tsx`, metadata sumber pada `types.ts`/`normalize-overview.ts`, helper periode pada `lib/overview.ts`, npm scripts/dependencies/lockfile, serta README. CSS, komponen grafik, dan rumus engine Phase 2 tidak diubah pada Phase 3.

Paket langsung yang dipasang: `google-auth-library` 11.3.2 dan `server-only` 0.0.1. Tidak memasang paket `googleapis` penuh. Runner tetap `node:test`; kondisi `react-server` dipakai pada proses Node tes/verifikasi untuk marker server-only.

## Validasi

Hasil terbaru: ESLint PASS, TypeScript PASS, **44/44 tes PASS**, `git diff --check` PASS, dan production build `npm run build -- --webpack` PASS. Build Turbopack masih memiliki hambatan port worker CSS yang sudah tercatat pada fase sebelumnya. Tes terfokus mencakup pemetaan, header, blank/partial rows, bentuk malformed, worksheet/locale, klasifikasi error dan redaksi, pemilihan sumber, TTL, concurrent load, stale/cooldown/recovery, appended rows, tanpa fallback mock, serta integrasi/filter Phase 2.

`npm run verify:sheets` berhasil dengan `READ_AND_PIPELINE_VERIFIED`. Perintah menjalankan pembacaan nyata menggunakan environment server, lalu hanya mencetak status tersanitasi, jumlah baris, quality counts, dan KPI agregat dari engine. Tidak mencetak raw rows atau credential. Exit nonzero tetap berarti read/pipeline belum terverifikasi atau mock yang dipilih pada percobaan berikutnya.

Browser visual, hydration, dan layout mobile tidak diverifikasi pada Phase 3. Keberhasilan unit test atau build tidak dianggap sebagai bukti hasil live.

## Referensi teknis

- [Google Sheets values.get: rentang, FORMATTED_VALUE dan scope](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get)
- [Google Sheets spreadsheets.get: metadata dan field mask](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get)
- [Google authentication library](https://www.npmjs.com/package/google-auth-library)
- Panduan Next.js yang dibaca dari `node_modules/next/dist/docs/`: Server/Client Components, `connection`, `io`, dan `use cache` untuk versi yang terpasang.
