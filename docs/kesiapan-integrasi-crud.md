# Kesiapan integrasi Google dan CRUD

## Konfigurasi produksi

- Gunakan `.env.example` sebagai acuan. Set `SITE_URL` dan `AUTH_URL` ke alamat HTTPS production yang sama. Daftarkan callback Google `https://<domain>/api/auth/callback/google`.
- Simpan kredensial Auth.js dan service account sebagai variabel server di hosting. Verifikasi login administrator, pembatasan akun, dan koneksi Sheets di preview.
- Dashboard membaca `Overview Operasional` dan `Overview Finance`. `All Overview` menggantikan rekap gabungan `Version 3.0 testing` dan dihitung otomatis dari sumber resmi. Input aktivitas tetap memakai tab `2026`.
- Jalankan instalasi terkunci, lint, typecheck, tes, dan production build sebelum publikasi. Mulai dengan flag penulisan nonaktif. Aktifkan fitur simpan satu per satu seusai uji izin akun, simpan, dan baca ulang pada lingkungan yang disetujui.

## Catatan konfigurasi pengujian

Mulai dari login dan otorisasi Google, lalu uji penyimpanan pada spreadsheet salinan sebelum mengaktifkan CRUD.

## Yang sudah ada dalam kode

- Pembacaan dashboard menggunakan Google Sheets. Status koneksi sebenarnya perlu diperiksa di lingkungan yang akan digunakan.
- Auth.js memiliki provider Google dan pembatasan email terverifikasi melalui `AUTH_GOOGLE_ALLOWED_EMAILS`.
- Penyimpanan identitas aplikasi, pembelian solar, dan harga solar memiliki pemeriksaan sesi dan flag masing-masing. Kode tersebut belum membuktikan konfigurasi atau penulisan pada lingkungan aktif.
- Form tambah Petak Lahan menulis blok metadata dan tabel kosong ke `Okt 2026 - testing`; daftar petak membaca kode dan luas dari blok worksheet itu. Penulisan dibatasi oleh `FUEL_TESTING_ONLY=true`, `PLOT_OPERATIONAL_SHEET_NAME=Okt 2026 - testing`, dan `ENABLE_PLOT_WRITES=true`, serta hanya akun administrator.
- Form tambah petak mewajibkan kode, harga per hektar dalam Rupiah, dan luas; No. SPK opsional dan bisa ditambahkan kemudian dari Kelola SPK. SPK berikutnya ditulis hanya ke sel No. SPK yang kosong pada blok petak yang sama. Total nilai dihitung sebagai harga × luas dan total konsumsi solar mengikuti aktivitas. Dokumen SPK dan dokumen pendukung dikelola terpisah. Master Petak tidak digunakan.

## Urutan aktivasi

1. Buat OAuth client Google jenis Web application, daftarkan callback sesuai domain, dan konfigurasi variabel server sebagaimana dijelaskan di [pengambilan-solar-setup.md](pengambilan-solar-setup.md). Jangan memasukkan secret ke repository atau chat.
2. Konfigurasi service account di server. Pembaca dan penulis memakai credential yang sama; berikan akses editor hanya ke spreadsheet yang digunakan untuk pengujian.
3. Gunakan spreadsheet salinan yang berisi worksheet `Pengaturan` sesuai [pengaturan-aplikasi.md](pengaturan-aplikasi.md). Uji login akun yang diizinkan dan penolakan akun lain sebelum mengaktifkan `ENABLE_SETTINGS_WRITES=true` pada lingkungan pengujian.
4. Uji simpan, baca ulang, refresh, kegagalan koneksi, dan tampilan pengguna lain. Setelah itu uji pembelian dan harga solar secara terpisah dengan flag masing-masing; lihat [pengambilan-solar-setup.md](pengambilan-solar-setup.md) dan [validasi-harga-solar.md](validasi-harga-solar.md).
5. Gunakan `Okt 2026 - testing` sebagai sumber petak dan aktivitas untuk pengujian, sesuai format gabungan yang digunakan saat ini. Jangan bergantung pada `Master Petak - testing`. Penyimpanan blok baru memakai format blok pertama sebagai template, memeriksa duplikasi kode serta area kosong, dan membaca ulang kode/luas setelah penulisan. Jangan menulis ke tab produksi dengan flag testing.
6. Rancang dan uji hubungan ke aktivitas, pembelian solar, dokumen Drive, serta pembentukan rekap sebelum menjadikan `Version 3.0` hasil otomatis. Jangan menganggap satu form sebagai satu transaksi atomik di beberapa worksheet.

## Batas sebelum produksi

- Autentikasi, otorisasi server, validasi input, audit perubahan, dan penanganan hasil tulis yang belum pasti harus diuji untuk setiap operasi.
- Google Sheets tidak menyediakan transaksi lintas worksheet atau penguncian lintas server yang memadai. Strategi penulisan dan pemulihan harus dipastikan sebelum mendukung penulisan bersamaan.
- Upload Drive memerlukan OAuth dan izin Drive yang sesuai, serta aturan folder dan hak akses. Implementasi Sheets saja tidak menyimpan dokumen.
- Migrasi data lama memerlukan pencocokan dan rekonsiliasi yang ditinjau; kode petak, SPK, area, dan riwayat ambigu tidak boleh ditebak. Skema dan risiko dirinci dalam [phase-9-master-data-architecture.md](phase-9-master-data-architecture.md).
- Pada pengujian salinan `Okt 2026 - testing`, rumus C96 memakai `SUM(I99:I100)` dan tidak mencakup aktivitas pada baris berikutnya, termasuk data sintetis baris 104. Jangan mengubah rumus secara otomatis: makna total konsumsi dan keterkaitannya dengan angka monitor awal dan akhir perlu diverifikasi sebelum hasilnya direkonsiliasi.
- Pemeriksaan sheet uji tersebut belum membuktikan CRUD website bekerja. Jangan aktifkan penulisan pada data produksi hanya berdasarkan keberadaan kode.
- Jalankan `npm run verify:crud-testing` untuk memeriksa header worksheet testing dan meninjau rumus contoh secara baca saja. Pemeriksaan ini tidak membuktikan izin tulis ataupun penyimpanan website.
