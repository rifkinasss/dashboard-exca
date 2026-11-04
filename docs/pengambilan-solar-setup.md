# Input pengambilan solar

Fitur simpan tersedia dalam kode tetapi tetap dinonaktifkan secara default. Tanpa konfigurasi lengkap, form hanya dapat dipratinjau dan tidak menulis ke Google Sheets.

## Konfigurasi login Google

Buat OAuth client jenis Web application di Google Cloud dan tambahkan redirect URI berikut sesuai alamat aplikasi:

- Lokal: `http://localhost:3000/api/auth/callback/google` atau `http://127.0.0.1:3000/api/auth/callback/google`, sesuai alamat yang digunakan.
- Produksi: `https://<domain-aplikasi>/api/auth/callback/google`.

Isi environment server dengan `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, dan `AUTH_GOOGLE_ALLOWED_EMAILS` (daftar email dipisahkan koma). Nilai secret tidak boleh disimpan dalam repository. Daftar akun lokal sudah diatur di `.env` yang diabaikan Git; lingkungan lain perlu diatur secara terpisah. Restart server setelah mengubah environment.

Auth.js hanya menerima profil Google dengan email terverifikasi yang ada dalam daftar. Login harus diuji dengan akun yang diizinkan dan ditolak sebelum fitur penulisan diaktifkan. Jika konfigurasi belum lengkap, tombol login tidak ditampilkan.

## Tabel bulanan

Perencana tabel memeriksa header, tanggal, nomor, serta cakupan bulan. Bila bulan belum ada, perencana menempatkan header A–F baru setelah baris terakhir; bila bulan sudah ada, perencana memilih baris kosong berikutnya. Tabel kosong, bulan bercampur, header ganda untuk bulan yang sama, nomor duplikat, dan tabel lama tanpa ruang ditolak untuk ditinjau.

Penulis server memeriksa ulang sesi dan daftar akun, membaca worksheet terbaru, menolak target yang tidak kosong atau bergabung, memeriksa harga aktif dari tabel H–L pada worksheet Pengambilan Solar, menyimpan nilai harga dan biaya pada kolom E–F secara batch, lalu membaca hasilnya kembali. Nomor dan header dihasilkan oleh server. Penulis menggunakan service account terpisah dengan akses editor pada spreadsheet yang dituju; pembaca dashboard tetap read-only.

Untuk pengujian pada spreadsheet salinan, set `GOOGLE_WRITER_SERVICE_ACCOUNT_EMAIL` dan `GOOGLE_WRITER_PRIVATE_KEY` di environment server, pastikan `GOOGLE_SPREADSHEET_ID` menunjuk ke salinan, dan hanya setelah login teruji set `ENABLE_FUEL_WITHDRAWAL_WRITES=true`. Jangan mengaktifkan flag pada spreadsheet produksi sebelum uji simpan, penolakan akun, bulan baru, bulan lama, dan pembacaan ulang berhasil. Credential tetap di server dan tidak masuk repository.

Sesuai keputusan operasional, hanya satu pengguna menginput pada satu waktu dan tidak ada pengeditan worksheet bersamaan. Kunci dalam proses bukan kunci lintas server; bila kebutuhan ini berubah, gunakan mekanisme koordinasi bersama sebelum mengaktifkan multi-user. Tidak ada retry penulisan otomatis. Bila koneksi terputus atau pembacaan ulang gagal setelah permintaan dikirim, periksa worksheet sebelum mencoba lagi agar tidak menduplikasi transaksi. Google Sheets tidak menyediakan jaminan unik atau transaksi lintas pengguna yang setara database.
