# Pengaturan identitas aplikasi

Worksheet `Pengaturan` memakai `A1:B3`: header `Kunci` dan `Nilai`, diikuti `nama_aplikasi` dan `warna_utama`. Tema yang didukung adalah `orange`, `blue`, `green`, dan kode warna HEX CSS enam digit seperti `#EA580C`. Perubahan lewat website menggunakan teks biasa dan hanya diproses jika struktur dan nilai worksheet sesuai.

Kolom `Keterangan` dan bagian `Rujukan pengaturan` mendokumentasikan pengisian spreadsheet. Konfigurasi OAuth, sumber dashboard, dan flag penulisan dikelola melalui variabel server.

Untuk mengaktifkan penyimpanan bersama, konfigurasikan `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_ALLOWED_EMAILS`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, dan `GOOGLE_PRIVATE_KEY` di lingkungan server. Berikan service account akses editor ke spreadsheet, lalu atur `ENABLE_SETTINGS_WRITES=true`. Jangan simpan nilai rahasia di repository. Login, penolakan akun yang tidak diizinkan, penyimpanan, dan pembacaan ulang harus diuji sebelum digunakan bersama.

Penyimpanan menolak perubahan jika nama atau warna di worksheet sudah berubah sejak form dibuka; muat ulang sebelum mencoba kembali. Pemeriksaan ini tidak menyediakan penguncian atomik Google Sheets: dua penulis yang menyimpan bersamaan masih dapat saling menimpa, sehingga perubahan harus dilakukan satu pengguna pada satu waktu.

Nama dan token warna utama dibaca ulang secara berkala. Beberapa warna visual lama masih ditentukan langsung di komponen dan belum mengikuti pilihan tema. Metadata dan gambar Open Graph masih menggunakan identitas bawaan. Jika pembacaan gagal, aplikasi mempertahankan tampilan terakhir selama sesi browser dan tidak menganggap nilai bawaan sebagai data yang telah tersimpan.

### Hak akses

Daftar `AUTH_GOOGLE_ALLOWED_EMAILS` memberikan akses administrator melalui konfigurasi server. Administrator juga dapat mengelola akun tambahan dari tab Hak akses dengan peran `viewer`, `operator`, atau `admin`. Operator dapat mencatat transaksi yang diizinkan.

Daftar disimpan pada worksheet `Hak Akses`, dengan header `Email` dan `Peran`. Jika worksheet belum ada, aplikasi mencoba membuatnya ketika administrator pertama kali menambahkan akun. Service account perlu memiliki izin menulis ke spreadsheet dan `ENABLE_SETTINGS_WRITES=true`. Pencabutan menetapkan peran `revoked`. Aplikasi memeriksa kembali daftar ini saat memvalidasi sesi akun tambahan. Dashboard operasional dan keuangan dapat dibuka tanpa login, sedangkan halaman manajemen meminta sesi. Kelola akun melalui aplikasi dan hindari pengeditan manual bersamaan dengan perubahan akses.

Sesi login kedaluwarsa 7 hari sejak token sesi terakhir diterbitkan atau diperbarui. Pemeriksaan sesi yang memperbarui cookie memperpanjang masa berlaku. Akun tambahan yang dicabut aksesnya kehilangan sesi pada pemeriksaan berikutnya. Hak akses admin utama mengikuti konfigurasi server.
