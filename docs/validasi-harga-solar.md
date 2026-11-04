# Harga solar dan pengambilan

Harga dan persetujuan dibaca dari tabel H–L worksheet `Pengambilan Solar`, mulai baris 4 dengan kolom `No`, `Tanggal Berlaku`, `Harga Solar per Liter`, `Status`, dan `Keterangan`. Kolom status harus berupa boolean Google Sheets `TRUE` atau `FALSE`. Setiap tanggal yang disetujui boleh tetap `TRUE` agar riwayat dapat dihitung sesuai tanggal transaksi.

Harga yang dipakai adalah harga `TRUE` dengan tanggal berlaku paling akhir yang tidak melewati tanggal pengambilan. Harga berikutnya yang belum aktif tidak menimpa harga sebelumnya. Tanggal ganda, harga tidak valid atau status bukan boolean menyebabkan katalog ditolak untuk ditinjau. Tidak ada kenaikan otomatis pada tanggal 5: harga dan tanggalnya diinput serta disetujui secara manual.

Worksheet `Pengambilan Solar` memakai kolom A–F: `No`, `Tanggal Ambil`, `Solar`, `No Petak`, `Harga Solar`, dan `Biaya Solar`. Saat penyimpanan sudah diaktifkan, server memeriksa ulang master dan kesesuaian harga pada pratinjau, lalu menyimpan harga dan biaya sebagai nilai pada transaksi. Harga dan biaya yang sudah tersimpan tidak berubah bila master berubah. Bila belum ada harga yang berlaku, transaksi tidak disimpan.

Baris lama dengan kolom E–F kosong ditampilkan sebagai **estimasi** berdasarkan master saat ini; nilainya tidak ditulis otomatis ke spreadsheet dan dapat berubah jika master diubah. Snapshot yang tidak lengkap atau tidak sesuai perkalian ditandai perlu tinjauan tanpa menghapus volume solar. Tidak ada perubahan pada perhitungan dashboard keuangan.

Penyimpanan tetap dinonaktifkan sampai login dan service account penulis dikonfigurasi serta diuji pada salinan spreadsheet. Lihat `pengambilan-solar-setup.md`. Worksheet `Master Harga Solar` yang terpisah maupun worksheet validasi terpisah tidak dipakai sebagai sumber harga.


## Input dan aktivasi melalui website

Halaman Pembelian Solar menampilkan riwayat harga, termasuk yang belum aktif, serta form Tambah harga. Harga baru dapat disimpan dengan status belum aktif atau langsung disetujui. Aktivasi baris `FALSE` dilakukan secara terpisah setelah konfirmasi; harga lama tidak dinonaktifkan otomatis. Transaksi baru menggunakan harga disetujui yang berlaku pada tanggalnya. Estimasi transaksi lama tanpa snapshot dapat berubah jika harga historis ditambah atau diaktifkan.

Penulisan harga menggunakan akun penulis dan daftar login yang sama seperti pengambilan, tetapi dikunci dengan flag terpisah `ENABLE_FUEL_PRICE_WRITES=true`. Flag tidak aktif secara default. Sebelum mengaktifkannya, uji login, input, aktivasi, penolakan akses, hasil jaringan tidak pasti, dan pembacaan kembali pada spreadsheet salinan. Pengguna yang sama harus tetap mengikuti aturan satu orang pada satu waktu tanpa mengedit worksheet bersamaan. Jika hasil simpan atau aktivasi tidak pasti, periksa tabel harga sebelum mencoba lagi.
