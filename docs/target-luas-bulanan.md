# Target luas bulanan

Target saat ini adalah 60 ha per bulan, ditetapkan di `src/features/dashboard/config/monthly-target.ts`. Rentang tanggal di sidebar menentukan periode dashboard. Untuk menghitung capaian, pilih tanggal awal dan akhir satu bulan kalender penuh. Rentang tanggal sebagian bulan, beberapa bulan, atau semua tanggal tidak menghasilkan capaian target. Filter petak dan status tetap berlaku, sehingga target menunjukkan capaian petak yang sesuai filter tersebut.

Petak dihitung paling banyak sekali per bulan bila memiliki peristiwa bertanggal dengan label sumber `Garap Petak Selesai`, tanpa membedakan kapitalisasi atau spasi berulang. Status tidak dikenal dan label sumber lain, termasuk `Selesai` tanpa label lengkap, tidak dihitung sebagai peristiwa ini. Tanggal peristiwa menentukan bulan; tanggal lain dan baris duplikat tidak menambah luas. Luas berasal dari metadata inventaris per petak dan tidak dijumlahkan dari setiap baris aktivitas. Luas kosong, nol, negatif, tidak valid, atau bertentangan dikecualikan dan dilaporkan pada panel kualitas data untuk bulan dan filter yang dipilih.

Persentase dihitung dengan luas selesai dibagi 60 ha tanpa pembulatan antara; angka ditampilkan dengan format Indonesia. Sisa adalah maksimum antara nol dan selisih target dengan luas selesai. Capaian di atas 100% tetap ditampilkan, sementara panjang progress bar dibatasi 100%.

Kebijakan pembukaan kembali petak dan penyelesaian parsial belum ditentukan: setiap peristiwa selesai yang tercatat dihitung untuk bulan peristiwa tersebut, tanpa menafsirkan apakah pekerjaan dibuka kembali atau memperkirakan persentase penyelesaian. Metadata luas menggunakan inventaris seluruh sumber, bukan snapshot luas historis per tanggal. Tidak ada asumsi luas berubah seiring waktu.

Kolom stok tangki tetap dibaca dan divalidasi di internal, termasuk pengecekan nilai negatif. Nilainya tidak ditampilkan pada tabel aktivitas maupun panel kualitas data; panel kualitas tetap menyajikan lokasi sumber dan temuan yang tersanitasi.
