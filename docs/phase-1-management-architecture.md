# Excavator Management — Architecture Notes

## Ruang lingkup dan status

Shell navigasi bersama membungkus dashboard operasional dan keuangan serta modul manajemen. `/petak` dan `/spk` adalah halaman baca-saja berbasis Google Sheets dengan pencarian, filter, pengurutan, pagination, detail, dan rujukan baris sumber. Form tambah/edit petak adalah draft interaktif dengan tombol simpan nonaktif; tidak ada data yang disimpan. Administrasi dokumen SPK belum ada pada worksheet saat ini dan ditandai sebagai belum tersedia, bukan disimpulkan dari progres kerja. `/solar` dan `/keuangan` tetap placeholder. Belum ada autentikasi, storage management, atau endpoint mutasi.

## Kontrak repository mendatang

`src/features/management/repository.ts` memisahkan antarmuka Read, Create, Update, dan Archive untuk petak, aktivitas, transaksi pengisian, dokumen SPK, dan asosiasi. Semua itu hanya tipe; belum ada adapter write. ID dan token versi bukan klaim bahwa Google Sheets mempunyai identitas stabil atau kontrol konkurensi. Sebelum implementasi, tetapkan ID stabil yang tidak bergantung pada nomor baris, aturan arsip, transaksi, konflik versi, validasi, audit, izin per peran, dan pemulihan. Operasi tulis harus dilakukan di server setelah autentikasi dan otorisasi; service account browser atau mutation endpoint tanpa perlindungan tidak boleh dibuat.

## Model petak-first

`PlotMaster` memakai `PlotId` stabil yang dibuat server dan kode petak unik; luas boleh kosong sampai tersedia. `WorkActivity` menyimpan HM dan status kerja dengan `plotId` wajib dan asosiasi SPK opsional. `FuelRefillTransaction` terpisah dari aktivitas dan dapat menyimpan `plotId` tanpa SPK atau aktivitas. Semua entitas menyimpan provenance sumber; nomor baris hanya referensi, bukan ID. ID baru dibuat di server, bukan dikirim dari form.

`SpkDocument` memiliki `SpkId`, nomor SPK bertipe string, status administrasi, dan referensi dokumen. `PlotSpkAssociation` memisahkan relasi dari master petak: status relasi `pending` boleh memiliki `spkId: null`, sedangkan status `linked` menunjuk satu SPK. Satu dokumen SPK dapat memiliki banyak asosiasi ke petak. Status administrasi dan status pekerjaan berada di entitas berbeda.

Alur petak baru membuat master tanpa SPK wajib dan sebuah asosiasi pending. Aktivitas sebelum SPK terbit dapat menunjuk asosiasi pending; ketika SPK tersedia, asosiasi yang sama diperbarui menjadi linked. ID dan nilai aktivitas tetap, tidak dibuat ulang. Aktivitas lama yang belum menunjuk asosiasi hanya dapat ditautkan lewat pilihan eksplisit. Untuk pekerjaan ulang pada petak yang sama dengan SPK berbeda, buat asosiasi terpisah dan arahkan setiap aktivitas ke asosiasi yang sesuai; jangan menebak berdasarkan status selesai atau rentang tanggal. Jika kepemilikan aktivitas tidak jelas, hentikan penautan dan minta tinjauan.

`preparePlotCreation`, `linkPendingSpk`, dan `attachActivitiesToAssociation` hanya memvalidasi atau membentuk draft domain di memori. Ketiganya bukan repository, tidak melakukan persistensi, dan tidak dipanggil sebagai operasi penyimpanan form.

Read model petak memakai `buildDashboardViewModel` untuk normalisasi, validasi, deduplikasi, inventaris, dan pengukuran kanonis seluruh tanggal. Read model SPK memakai nilai SPK hasil normalisasi dan `buildFinanceView` untuk relasi Finance. Relasi Finance mengikuti SPK+petak; fallback petak hanya dilakukan oleh aturan relasi yang ada jika pasangan unik. Baris Finance yang tidak cocok atau duplikat tidak dipakai sebagai nilai terverifikasi. Pengukuran tanpa tanggal tidak dimasukkan ke rentang dan jumlah aktivitas bertanggal. Nilai luas inventaris adalah metadata plot, bukan jumlah luas berulang tiap aktivitas.

## Audit sumber read-only

Pemeriksaan Google Sheets pada 2 November 2026 membaca metadata dan sel A1:P1000 pada `Overview Operasional` serta A1:K1000 pada `Overview Finance`, tanpa menulis data. Operasional memiliki 21 rentang merge, 8 sel formula yang teramati di kolom D, E, I, J, K, L, M dan N, serta 23 sel validasi daftar pada kolom O. Finance memiliki 1 rentang merge dan 23 sel formula yang teramati pada kolom D–K, termasuk formula I, J dan K. Jumlah tersebut adalah snapshot dan dapat berubah.

Delapan formula pada masing-masing worksheet mengandung referensi rentang yang terdeteksi secara tekstual; tidak ada referensi lintas worksheet eksplisit yang terdeteksi dalam sampel. Pemeriksaan ini bukan analisis menyeluruh terhadap named ranges, `INDIRECT`, sel di luar rentang, dependensi eksternal, proteksi, atau perubahan bersamaan. Perlakukan sel formula, merged cells, dropdown, baris total dan range bergantung sebagai area terlindungi sampai diverifikasi lengkap. Menulis satu baris spreadsheet secara mentah dapat merusak seluruhnya.

Operasional menggunakan A–P: B nomor SPK, C kode petak, D luas, E total konsumsi kumulatif, F tanggal, I HM kerja, K pengisian solar, M solar riil, O status kerja. Merge B/C dibaca eksplisit; E bukan nilai untuk dijumlahkan per aktivitas. Finance menggunakan A–K dengan SPK dan petak sebagai kunci pencocokan; fallback petak hanya jika unik. Duplikasi atau hubungan ambigu tidak boleh dipakai sebagai dasar mutasi. Skema ini tidak menyediakan ID internal stabil untuk plot, asosiasi, aktivitas, atau transaksi solar. Data SPK yang ada tidak menyediakan status administrasi dan referensi dokumen.

## Keamanan dan checkpoint

Google Sheets tetap menggunakan scope `spreadsheets.readonly`. Shell ini tidak menambah autentikasi. Sebelum membuka CRUD, tentukan kebijakan autentikasi/otorisasi (misalnya Auth.js dan Google OAuth), perlindungan CSRF, audit trail, penanganan sesi dan akses service account. File credential pernah tercatat di riwayat Git; rotasi key dan penanganan riwayat tetap harus diselesaikan. Aplikasi saat ini tidak boleh dianggap siap untuk akses publik hanya karena modul baca-saja tersedia.

Checkpoint sebelum mengaktifkan CRUD: sepakati pemetaan ID stabil dan migrasi dari kode/baris sumber, kebijakan kode petak duplikat, aturan masa berlaku asosiasi SPK, pilihan aktivitas historis saat SPK ditautkan belakangan, aturan arsip, serta audit log. Lalu implementasikan autentikasi dan otorisasi server-side dan uji konkurensi/pemulihan.

## Strategi tulis yang belum diaktifkan

Jangan menulis ke baris yang berisi metadata SPK/petak hasil sel gabungan seolah-olah setiap baris memilikinya. Sebelum write adapter dibuat, petakan anchor dan rentang merge, formula serta dropdown/proteksi; pertahankan rumus dan validasi; dan tetapkan operasi server yang atomik, pemeriksaan versi, audit trail, serta izin least-privilege. Perubahan pada aktivitas harus menulis ke baris aktivitas yang benar tanpa mengisi ulang sel gabungan di bawahnya. Edit atau arsip plot/SPK memerlukan aturan kepemilikan serta dampak pada formula dan baris terkait. Kredensial spreadsheet tetap `spreadsheets.readonly`.
