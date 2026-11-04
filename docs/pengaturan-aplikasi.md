# Pengaturan identitas aplikasi

Worksheet `Pengaturan` memakai `A1:B3`: header `Kunci` dan `Nilai`, diikuti `nama_aplikasi` dan `warna_utama`. Tema yang didukung adalah `orange`, `blue`, dan `green`. Perubahan lewat website menggunakan teks biasa dan hanya diproses jika struktur dan nilai worksheet sesuai.

Untuk mengaktifkan penyimpanan bersama, konfigurasikan `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_ALLOWED_EMAILS`, `GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL`, dan `GOOGLE_WRITER_PRIVATE_KEY` di lingkungan server. Berikan akun penulis akses ke spreadsheet, lalu atur `ENABLE_SETTINGS_WRITES=true`. Jangan simpan nilai rahasia di repository. Login, penolakan akun yang tidak diizinkan, penyimpanan, dan pembacaan ulang harus diuji sebelum digunakan bersama.

Nama dan token warna utama dibaca ulang secara berkala. Beberapa warna visual lama masih ditentukan langsung di komponen dan belum mengikuti pilihan tema. Metadata dan gambar Open Graph masih menggunakan identitas bawaan. Jika pembacaan gagal, aplikasi mempertahankan tampilan terakhir selama sesi browser dan tidak menganggap nilai bawaan sebagai data yang telah tersimpan.
