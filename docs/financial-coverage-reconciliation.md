# Rekonsiliasi dashboard keuangan

Pembacaan Google Sheets dilakukan secara read-only pada 1 November 2026. Hasil adalah snapshot dan dapat berubah setelah sumber diperbarui.

## Alur dan cakupan

Repository membaca `Overview Finance` kolom A–K dan `Overview Operasional` A–P beserta metadata sel gabungan. Normalisasi hanya mengisi identitas dari rentang gabungan yang eksplisit dan tidak ambigu; nomor baris sumber tetap disimpan. Hubungan memakai SPK dan kode petak, atau kode petak saja jika menghasilkan tepat satu pasangan. Kunci duplikat dan hubungan ambigu dikeluarkan dari agregasi, tetap ditampilkan dalam tabel, dan dicatat pada panel kualitas data.

Tanggal memfilter aktivitas operasional. Snapshot keuangan tidak memiliki tanggal transaksi; karena itu KPI dan grafik finansial tidak diberi atribusi pada rentang tanggal. Tabel tetap menampilkan snapshot seluruh waktu dengan filter SPK dan petak. Baris total spreadsheet tidak ditambahkan kembali.

Pendapatan kotor memakai kolom J. Biaya memakai kolom I hanya ketika harga solar G dan pengisian H tersedia dan perkaliannya cocok dengan nilai I. Margin adalah J dikurangi I pada baris yang sama. Subtotal adalah penjumlahan baris yang unik dan valid; cakupan adalah jumlah baris valid terhadap seluruh baris sumber dalam cakupan SPK/petak. Proporsi hanya memakai populasi dengan pendapatan dan biaya yang sama-sama valid; sisa pada donut adalah pendapatan berpasangan dikurangi biaya berpasangan, bukan laba bersih.

## Rekonsiliasi sumber

| Overview Finance | Petak | Pendapatan kotor | Biaya terverifikasi | Margin |
| --- | --- | ---: | ---: | ---: |
| 2 | 72A1/J54 | Rp35.955.740 | Rp13.475.000 | Rp22.480.740 |
| 3 | 72C/J54 | Rp29.684.390 | Rp11.025.000 | Rp18.659.390 |
| 4 | 72C1/J54 | Rp34.701.470 | Rp5.880.000 | Rp28.821.470 |
| 5 | 82C/J54 | Rp57.278.330 | Rp10.290.000 | Rp46.988.330 |
| 6 | 82C1/J54 | Rp49.334.620 | Belum terverifikasi | Belum tersedia |

Lima pasangan cocok. Pendapatan kotor Rp206.954.550 mencakup 5/5 baris. Biaya Rp40.670.000 dan margin Rp116.949.930 masing-masing mencakup 4/5 baris dan merupakan subtotal parsial. Pendapatan berpasangan Rp157.619.930 dikurangi biaya berpasangan Rp40.670.000 menghasilkan margin Rp116.949.930. Baris 6 belum memiliki pengisian solar di sumber keuangan, sehingga biaya tidak dapat diverifikasi. Baris total sumber nomor 22 dikecualikan dari penjumlahan.

Belum ada tanggal transaksi pada sumber keuangan; penerimaan kas aktual tidak dapat disimpulkan. Atas persetujuan pengguna, grafik estimasi harian membagi pendapatan sumber dan biaya terverifikasi menurut proporsi HM pada seluruh riwayat aktivitas pasangan SPK/petak. Filter tanggal diterapkan setelah alokasi. Pasangan dengan tanggal atau HM tidak lengkap/tidak valid, atau total HM nol, dikecualikan dan dilaporkan; biaya yang belum terverifikasi tetap kosong. Angka adalah estimasi, bukan transaksi kas. Cara menangani biaya yang melebihi pendapatan untuk proporsi memerlukan keputusan bisnis. Donut tidak ditampilkan jika jumlah berpasangan tidak memenuhi syarat proporsi.
