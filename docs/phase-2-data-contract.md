# Phase 2: kontrak dan aturan data Overview

> Catatan historis: aturan inventaris, metadata, status, dan area diperbarui pada 30 Oktober 2026. Lihat [laporan inventaris terbaru](plot-inventory-2026-10-30.md) untuk perilaku yang berlaku.

## Batas dan inspeksi awal

Implementasi frontend saja, tanpa API, kredensial Google, backend, database, atau perubahan spreadsheet. Layout, CSS, filter, tampilan grafik, loading, dan empty state Phase 1 dipertahankan. Satu disclosure Kualitas data ditambahkan untuk memeriksa temuan. Perubahan perhitungan dijelaskan di bawah.

Sebelum perubahan, proyek memiliki `types.ts`, fixture 64 aktivitas sintetis, filter/agregasi di `lib/overview.ts`, enam tes dengan `node:test`, serta komponen KPI/grafik/tabel yang menerima summary. Titik lemah yang ditemukan: belum ada parsing raw rows, belum ada traceability sumber, `No` dianggap unik/tie-breaker, luas memakai nilai terbaru tanpa pemeriksaan konflik, dan validasi hanya menyaring nilai negatif/non-finite tanpa laporan.

Runner `node:test`, `tsc`, formatter angka/tanggal, filter controls, komponen grafik, KPI, dan tabel digunakan kembali. Tidak ada dependensi baru.

## Kontrak sumber

`RawOverviewRow` adalah array sel readonly berupa string/number/boolean/null/undefined. Input **tidak menyertakan header**. `firstDataRow` default 2 menunjuk posisi fisik baris pertama setelah header. Posisi ini harus disesuaikan oleh adapter Phase 3 jika header tidak berada pada baris 1. Jangan memadatkan atau mengurutkan ulang raw rows sebelum normalisasi tanpa mempertahankan referensi fisiknya.

| Kolom | Header | Field normalisasi |
| --- | --- | --- |
| A | No | no |
| B | Kode Petak | plotCode |
| C | Luas Petak (Ha) | plotArea |
| D | Total Konsumsi Solar | totalFuelConsumption |
| E | Tanggal | date |
| F | HM Awal | hmStart |
| G | HM Akhir | hmEnd |
| H | HM Kerja (Jam) | workingHours |
| I | Est. Jam Kerja | estimatedWorkingHours |
| J | Pengisian Solar (L) | fuelRefill |
| K | Pemakaian Solar per Jam (L/Hr) | fuelPerHour |
| L | Pemakaian Solar Riil (L) | actualFuelUsage |
| M | Sisa/Stok Tangki (L) | remainingFuel |
| N | Status Pekerjaan | workStatus |
| O | Keterangan | notes |

Semua angka nullable, termasuk `no`; B kosong dinormalisasi menjadi string kosong dan dicatat sebagai error. `No` bukan identitas unik. Setiap record menyimpan `source: { worksheet: 'Overview', row }`, salinan `raw`, dan `cellStates` untuk membedakan valid/missing/invalid. Nilai negatif yang dapat diparse tetap disimpan pada record, lalu dikecualikan dari metrik terkait oleh validasi. Nilai yang tidak dapat diparse menjadi null dengan status invalid, bukan missing. Nilai mentah selalu tetap tersedia.

## Normalisasi

- Pipeline menggunakan kebijakan eksplisit `numberPolicy: 'id-ID'`. `1.460` = 1460, `9,9` = 9.9, `1.460,25` = 1460.25. Native number finite diterima tanpa diubah. Tidak ada penghapusan pemisah secara sembarang sebelum format diperiksa.
- `parseOverviewNumber` tanpa kebijakan memakai `strict`: satu titik seperti `1.460` ditolak sebagai ambigu. Pengelompokan berulang `1.234.567` dan bentuk Indonesia dengan desimal `1.460,25` diterima. Format Inggris seperti `1,460.25`, string desimal bertitik `9.9`, unit, simbol mata uang, scientific notation string, boolean, NaN, dan Infinity ditolak. Adapter nanti harus mengirim nilai number asli atau format Indonesia; jangan menebak locale per sel.
- Sel kosong/whitespace/null/undefined menghasilkan missing/null. Nol numerik dan string `0` tetap valid/0.
- Tanggal diterima dalam bentuk `YYYY-MM-DD`, `D/M/YYYY`, `D-M-YYYY`, dan `D <nama bulan Indonesia lengkap> YYYY`. Kalender diperiksa, termasuk tahun kabisat. `1/2/2026` berarti 1 Februari. Tahun dua digit, serial numerik Sheets, timestamp, format AS, dan tanggal tidak valid ditolak. Tidak ada fallback tanggal hari ini.
- Tanggal disimpan sebagai kalender lokal, bukan UTC timestamp. Tampilan tetap melalui formatter Asia/Makassar yang ada; tidak menggeser date-only antar-zona waktu.
- Kode petak di-trim dan dijadikan uppercase; angka finite dapat menjadi kode string. Tidak mengubah tanda hubung, spasi internal, atau menambah nol yang hilang.
- Status hanya empat nilai Phase 1, dicocokkan tanpa membedakan kapitalisasi dan spasi berulang. Status lain menjadi null + warning, tanpa menerka sinonim bisnis. Notes string di-trim.
- Kolom setelah O disimpan pada raw dan menghasilkan warning; kolom yang terpotong menghasilkan missing pada bidang terkait.

## Pipeline dan perhitungan

`buildDashboardViewModel(rawRows, filters, options)` menjalankan normalisasi → validasi seluruh sumber → filter → agregasi → view model. Semua KPI/grafik/tabel memakai satu hasil filter. Komponen React tidak menghitung rumus bisnis sendiri.

Baris dengan B atau E missing/invalid serta duplikat tepat dikeluarkan dari seluruh view agar KPI dan chart mempunyai cakupan sama. Kolom lain yang invalid hanya memengaruhi metrik terkait. Validasi dilakukan sebelum filter agar konflik luas tidak hilang hanya karena pengguna memilih satu tanggal.

| Metrik | Aturan dan pengecualian |
| --- | --- |
| Total petak | Jumlah kode petak berbeda pada dataset yang lolos filter |
| Solar masuk | Jumlah J valid dan tidak negatif |
| Solar riil | Jumlah L valid dan tidak negatif |
| HM kerja | Jumlah H valid dan tidak negatif; H yang berkonflik dengan F/G dikecualikan |
| Efisiensi | SUM(L) / SUM(H), hanya pasangan L/H valid dalam satu baris dengan H > 0; HM yang tidak konsisten tidak dipakai |
| Solar/HM/efisiensi per petak | Rumus KPI yang sama pada kelompok kode petak |
| Tren harian | Jumlah L per tanggal, plus `byPlot` untuk seri tiap petak. Hari tanpa aktivitas tidak ditambahkan sebagai nol |
| Luas petak | Satu nilai C non-null konsisten; bukan SUM/MAX/MIN/nilai terbaru. Konflik → null dan `areaRequiresReview` |
| Total luas | Jumlah luas unik hanya jika semua petak pada view memiliki luas yang dapat dipastikan. Jika satu saja belum diketahui/konflik, total luas null |
| Status | Status valid pada tanggal aktivitas terbaru; status null pada tanggal lebih baru tidak menghapus status terakhir yang diketahui |
| D dan M | Disimpan saja; tidak dijumlahkan atau dipakai sebagai pengganti J/L |
| I dan K | Disimpan saja; K tidak dipakai untuk rata-rata efisiensi |

**Asumsi interval:** H dan L pada satu baris merujuk aktivitas/interval operasional yang sama. F/G adalah meter untuk interval H tersebut. Ini asumsi kontrak untuk prototipe, belum dikonfirmasi pada data nyata. Tidak ada pairing antarbaris, derivasi H dari F/G, atau pengisian L dari K.

Jumlah tanpa satu pun nilai valid menghasilkan null, bukan 0. Total dengan sebagian pengukuran valid menjumlahkan yang tersedia dan disertai pemberitahuan. Nol riil tetap 0. Nilai non-finite ditolak saat parsing; bila operasi aritmetika dari angka finite sangat ekstrem tidak dapat direpresentasikan, hasilnya null agar tidak mengirim NaN/Infinity ke chart. Tidak ada batas maksimum operasional yang dikarang.

Filter tanggal inklusif; batas kosong berarti terbuka, rentang terbalik/tidak valid memberi view kosong. Pilihan dalam kelompok petak/status menggunakan OR dan kelompok digabung AND. Filter status memakai status petak setelah pembatasan tanggal dan mempertahankan seluruh aktivitas petak yang cocok pada rentang tersebut.

## Validasi, tingkat dan kebijakan penanganan

- **Informasi:** nilai opsional atau kedua pengukuran pasangan belum tersedia; konflik status dengan urutan sheet yang sudah dikonfirmasi.
- **Peringatan:** format non-identitas invalid, ketidaksesuaian H dengan selisih F/G, konflik luas/status, duplikat, pasangan efisiensi tidak tersedia, atau kolom berlebih.
- **Kesalahan:** B/E missing/invalid, nilai negatif pada C/H/J/L, serta G < F.

Jika G < F, H tidak dipakai untuk total HM maupun efisiensi. Jika H berbeda dari G−F lebih dari `1e-6` jam, H juga dikecualikan. Angka ini hanya toleransi floating point, bukan toleransi alat ukur atau pembulatan bisnis. Nilai H/F/G tidak dikoreksi otomatis; solar J/L tetap dihitung bila valid. Jika F/G kosong tetapi H/L valid, pairing satu baris tetap diperbolehkan dengan asumsi interval di atas.

Konflik C ditandai pada semua aktivitas petak itu di seluruh input; metrik solar/HM tidak ikut dibuang. Area yang belum terukur saja menghasilkan null tanpa menyatakan konflik.

**Urutan entri sheet belum dikonfirmasi.** Default `sheetOrderConfirmed: false`: status berbeda pada tanggal terbaru yang sama menghasilkan `status: null`, `statusAmbiguous: true`, dan label Perlu tinjau; tidak cocok dengan filter status yang diketahui. Setelah pemilik sumber mengonfirmasi urutan fisik sebagai urutan entri, adapter dapat mengirim `sheetOrderConfirmed: true`; baris fisik terbesar menentukan status pada tanggal sama. Kolom `No` tidak digunakan untuk tie-break. Konflik historis tetap dilaporkan meskipun tanggal terbaru sudah tidak ambigu.

**Duplikat tepat:** semua 15 nilai hasil normalisasi sama, termasuk A dan O; raw invalid cell turut dibandingkan berdasarkan tipe/nilainya agar dua kesalahan parsing berbeda tidak digabung. Baris fisik pertama dihitung; salinan berikutnya tetap disimpan tetapi dikecualikan, dengan referensi ke baris pertama. `No` berulang saja tidak cukup. Near-duplicate dengan nomor/catatan berbeda, interval tumpang tindih, dan kemungkinan aktivitas yang sah tetapi identik belum dapat dipastikan dari kontrak ini; kebijakan ini perlu dikonfirmasi sebelum penggunaan produksi.

Kualitas data dapat diperiksa lewat nilai balik `issues` dan disclosure dashboard yang menampilkan tingkat, sumber/kolom, nilai mentah, pesan, dan baris terkait. Temuan mencakup seluruh input sebelum filter, bukan hanya aktivitas yang sedang ditampilkan.

## Perubahan file

Ditambahkan:

- `lib/normalize-overview.ts`, `validate-overview.ts`, `derive-work-status.ts`
- `lib/calculate-kpis.ts`, `aggregate-by-plot.ts`, `aggregate-daily-trend.ts`, `build-dashboard-view-model.ts`
- `components/data-quality.tsx`
- `tests/fixtures.ts` dan lima file `*.test.ts`
- Dokumen ini.

Diubah: `types.ts` mengikuti nama kontrak Phase 2; `overview.ts` mempertahankan filter/default periode; fixture mock menjadi raw rows A–O; server entry dan Dashboard memakai pipeline baru; tiga komponen presentasi mengganti import tipe; KPI/tabel menampilkan ketidakpastian luas/status. `package.json` dan `tsconfig.test.json` mengarahkan runner yang ada ke suite baru. Enam tes lama dipindahkan/diperluas; bukan menambah runner kedua. CSS dan primitive UI tidak diubah pada Phase 2.

## Kesiapan Phase 3 dan ambiguitas tersisa

Batas input, output, parsing, validasi, dan traceability sudah tersedia untuk adapter sumber berikutnya. Ini belum sertifikasi terhadap spreadsheet nyata. Sebelum integrasi, konfirmasi locale/formatted vs unformatted values, format tanggal/serial, posisi header/baris, makna H/L sebagai satu interval, toleransi pembulatan HM, label status lain jika ada, urutan entri fisik, dan kebijakan duplikat. Semantik D/I/K/M di luar yang tertulis di kontrak tetap belum didefinisikan.

Tidak ada pemanggilan Google Sheets atau data produksi. Uji browser/hydration dan mobile Phase 1 yang belum lengkap tidak berubah status hanya karena tes engine berhasil.

## Hasil validasi Phase 2

Pada 29 Oktober 2026, `npm run lint`, `npm run typecheck`, `npm test` (31/31), dan production build `npm run build -- --webpack` lulus. Suite normalisasi/view model juga dijalankan dengan `TZ=Pacific/Honolulu` (16/16 lulus). Pengujian mencakup seluruh kategori yang diminta, termasuk filter gabungan, konsistensi KPI/chart, sumber baris, no-mutation, missing/zero/invalid, konflik, duplikat, dan angka chart yang tetap finite.

Dataset demo mempertahankan hasil Phase 1: 8 petak, luas 40,9 ha, pengisian 7.000 L, pemakaian riil 5.759 L, HM 367,5 jam. Rasio memakai 5.759 / 362 jam berpasangan, karena satu aktivitas dengan 5,5 jam belum memiliki pengukuran L. Ini hanya pemeriksaan fixture sintetis.

`npm run build` dengan Turbopack dieksekusi tetapi terhambat runtime: `binding to a port: Operation not permitted (os error 1)`. Build produksi Webpack tetap lulus dengan konfigurasi cadangan yang sudah ada dari Phase 1. Tidak ada klaim bahwa build Turbopack atau validasi browser telah lulus.
