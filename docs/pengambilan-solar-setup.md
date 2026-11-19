# Input pengambilan solar

Fitur simpan tersedia dalam kode tetapi tetap dinonaktifkan secara default. Tanpa konfigurasi lengkap, form hanya dapat dipratinjau dan tidak menulis ke Google Sheets.

## Konfigurasi login Google

Buat OAuth client jenis Web application di Google Cloud dan tambahkan redirect URI berikut sesuai alamat aplikasi:

- Lokal: `http://localhost:3000/api/auth/callback/google` atau `http://127.0.0.1:3000/api/auth/callback/google`, sesuai alamat yang digunakan.
- Produksi: `https://<domain-aplikasi>/api/auth/callback/google`.

Isi environment server dengan `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, dan `AUTH_GOOGLE_ALLOWED_EMAILS` (daftar email dipisahkan koma). Nilai secret tidak boleh disimpan dalam repository. Daftar akun lokal sudah diatur di `.env` yang diabaikan Git; lingkungan lain perlu diatur secara terpisah. Restart server setelah mengubah environment.

Auth.js hanya menerima profil Google dengan email terverifikasi yang ada dalam daftar. Halaman login tersedia di `/login`; tombol Google dinonaktifkan jika konfigurasi belum lengkap. Setelah login, akun dan tombol keluar tersedia di Pengaturan → Pengguna dan hak akses. Dashboard saat ini tetap dapat dibaca tanpa login; pemeriksaan sesi diterapkan pada operasi penulisan yang sudah diimplementasikan.

Sebelum mengaktifkan penulisan, uji login dengan akun yang diizinkan dan akun lain yang harus ditolak, kemudian uji keluar dan login kembali. Pastikan OAuth consent screen dan test users sesuai status aplikasi Google Cloud. `AUTH_SECRET` harus tetap stabil antar-restart dan sama di seluruh instance; menggantinya dapat membatalkan sesi. Pada produksi, isi variabel di environment server dan daftarkan callback domain produksi. Jangan kirim client secret melalui chat atau memasukkannya ke Git.

## Tabel bulanan

Perencana tabel memeriksa header, tanggal, nomor, serta cakupan bulan. Bila bulan belum ada, perencana menempatkan header A–F baru setelah baris terakhir; bila bulan sudah ada, perencana memilih baris kosong berikutnya. Tabel kosong, bulan bercampur, header ganda untuk bulan yang sama, nomor duplikat, dan tabel lama tanpa ruang ditolak untuk ditinjau.

Penulis server memeriksa ulang sesi dan daftar akun, membaca worksheet terbaru, menolak target yang tidak kosong atau bergabung, memeriksa harga aktif dari tabel H–L pada worksheet Pengambilan Solar, menyimpan nilai harga dan biaya pada kolom E–F secara batch, lalu membaca hasilnya kembali. Nomor dan header dihasilkan oleh server. Pembaca dan penulis memakai service account yang sama; pembacaan memakai scope read-only dan penulisan memakai scope tulis.

Untuk pengujian pada spreadsheet salinan, gunakan `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `GOOGLE_PRIVATE_KEY`, berikan akun tersebut akses editor pada salinan, pastikan `GOOGLE_SPREADSHEET_ID` menunjuk ke salinan, dan hanya setelah login teruji set `ENABLE_FUEL_WITHDRAWAL_WRITES=true`. Jangan mengaktifkan flag pada spreadsheet produksi sebelum uji simpan, penolakan akun, bulan baru, bulan lama, dan pembacaan ulang berhasil. Credential tetap di server dan tidak masuk repository. Karena akun yang sama dapat menulis ketika memiliki akses editor, lindungi credential tersebut dan gunakan flag untuk membatasi fitur aplikasi.

Pengujian lokal pada spreadsheet yang sama dapat diarahkan ke dua tab khusus melalui `FUEL_WITHDRAWAL_SHEET_NAME` dan `FUEL_PRICE_SHEET_NAME`. Keduanya wajib diisi bersama. Tabel pembelian menggunakan A–F mulai baris 4; tabel harga menggunakan H–L mulai baris 4. Dashboard lokal juga akan membaca pembelian dari tab uji, sedangkan sumber operasional lainnya tidak berubah. Kosongkan kedua variabel dan mulai ulang server untuk kembali ke sumber biasa. Tab terpisah bukan pengganti izin atau cadangan spreadsheet.

Worksheet `Okt 2026 - testing` adalah salinan rekap aktivitas, bukan tabel pembelian solar. Worksheet `Pengambilan Solar - testing` menyediakan tabel pembelian A–F dan master harga H–L; keduanya menjadi sasaran konfigurasi lokal pengujian. Jangan mengarahkan penulis pembelian ke salinan rekap karena struktur kolomnya berbeda. `Version 3.0 testing` adalah salinan format rekap dan belum terhubung otomatis ke data uji.

Di lingkungan lokal, `FUEL_TESTING_ONLY=true` membatasi penulis pembelian dan harga pada nama worksheet yang berakhiran `testing`; kedua nama harus diisi. Pengaman ini tidak memverifikasi bahwa worksheet ada atau bahwa strukturnya sesuai, dan tidak membatasi penulis lain. Form aktivitas operasional masih pratinjau; belum menyimpan ke `Okt 2026 - testing`.

Sesuai keputusan operasional, hanya satu pengguna menginput pada satu waktu dan tidak ada pengeditan worksheet bersamaan. Kunci dalam proses bukan kunci lintas server; bila kebutuhan ini berubah, gunakan mekanisme koordinasi bersama sebelum mengaktifkan multi-user. Tidak ada retry penulisan otomatis. Bila koneksi terputus atau pembacaan ulang gagal setelah permintaan dikirim, periksa worksheet sebelum mencoba lagi agar tidak menduplikasi transaksi. Google Sheets tidak menyediakan jaminan unik atau transaksi lintas pengguna yang setara database.
