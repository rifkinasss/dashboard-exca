# Phase 6B: integrasi operasional dan keuangan

## Sumber dan kontrak

Pembacaan read-only 31 Oktober 2026 menemukan `Overview Finance`, locale `id_ID`, header baris 1:

| Kolom | Header | Bentuk sumber yang ditemukan |
| --- | --- | --- |
| A | No | Nomor baris atau label Total |
| B | No. SPK | Identifier numerik diformat sebagai teks |
| C | Kode Petak | Teks |
| D | Luas Petak (Ha) | Angka |
| E | Harga Petak / Ha | Rupiah |
| F | Harga per Petak | Rupiah |
| G | Harga Solar | Rupiah |
| H | Pengisian Solar (L) | Angka atau kosong |
| I | Pengeluaran Solar | Rupiah; rumus `G × H` pada baris yang diperiksa |
| J | Pendapatan Kotor | Rupiah; merujuk F pada baris yang diperiksa |
| K | Pendapatan Bersih | Rupiah; rumus `J − I` pada baris yang diperiksa |

Tidak ditemukan kolom tanggal transaksi, pembayaran, penyelesaian, atau periode. Nilai J diperlakukan sebagai **nilai kotor sumber per SPK/petak**, bukan penerimaan kas aktual. K disimpan sebagai nilai sumber, bukan dilabeli laba bersih. Tidak ada asumsi penanggalan atau alokasi aktif.

Pemeriksaan menemukan lima baris data (2–6), 15 baris kosong, dan satu baris total (22). Total pada baris 22 memiliki merge horizontal A–C dan dikeluarkan dari agregasi, sehingga tidak dihitung dua kali. Lima pasangan `SPK + kode petak` cocok ke 20 baris aktivitas operasional (6, 4, 4, 4, dan 2 baris). Tidak ditemukan duplikasi pasangan keuangan, SPK hilang, pasangan keuangan tak cocok, atau pasangan operasional tak cocok pada snapshot ini. Snapshot dapat berubah.

Baris Finance 6 (`5123129042 / 82C1/J54`) memiliki H kosong, tetapi I dan K menghasilkan angka karena rumus spreadsheet memperlakukan H kosong sebagai nol. Biaya dan margin baris tersebut ditampilkan N/A. Total biaya dan margin tidak disajikan sebagai lengkap ketika satu atau lebih pasangan tidak lengkap. Data-quality mencatat `incomplete_fuel_cost` dengan referensi sumber.

## Aturan implementasi

- Adapter keuangan memakai transport JWT `spreadsheets.readonly` dan kebijakan cache/cooldown server yang sama, tanpa fallback mock finansial. Operasional dan keuangan memiliki cache independen per proses; snapshot tidak dijamin atomik dan dapat berbeda waktu sinkronisasinya.
- Kontrak keuangan disimpan terpisah dari operasional, dengan nilai mentah dan baris sumber. Hanya merge vertikal B atau C yang eksplisit dan tidak konflik dapat memberikan identitas; merge lain tidak diisi otomatis.
- Hubungan utama adalah pasangan SPK dan petak. Petak tanpa SPK hanya dipasangkan bila tepat satu pasangan operasional dan tepat satu baris keuangan untuk petak itu. Identitas sumber tetap kosong dan fallback dilabeli. Pasangan ganda, konflik, dan yang tak cocok dicatat serta dikecualikan dari nilai gabungan; tidak ada join many-to-many.
- Nilai pengeluaran solar sumber dipakai hanya jika harga, volume dan pengeluaran tersedia dan sesuai; nol akibat volume kosong tidak dianggap biaya terverifikasi. Margin setelah biaya solar dihitung sebagai nilai kotor sumber dikurangi biaya tersebut jika keduanya tersedia. Tidak semua biaya usaha termasuk di dalamnya.
- Filter SPK dan petak membatasi kedua domain. Filter tanggal/bulan membatasi aktivitas operasional; karena Finance tidak bertanggal, KPI/grafik keuangan berdasarkan periode ditampilkan N/A. Tabel snapshot yang jelas berlabel tidak bertanggal tetap menunjukkan nilai sumber untuk SPK/petak terpilih, bukan nilai untuk tanggal tersebut.
- Nilai kotor/biaya/margin total hanya ditampilkan ketika seluruh baris pada cakupan memiliki pasangan dan pengukuran yang diperlukan. Nilai kotor sumber seluruh waktu snapshot yang diperiksa adalah Rp206.954.550; biaya dan margin keseluruhan tidak lengkap. Angka ini bukan penerimaan kas terkonfirmasi.
- Fungsi alokasi analitik berbasis HM ada sebagai strategi opsional yang **dinonaktifkan**; UI dan pipeline produksi tidak memanggilnya. Diperlukan persetujuan aturan bisnis sebelum aktivasi, termasuk cakupan jam, data hilang/nol, periode lintas bulan, pembulatan dan arti pendapatan yang dialokasikan. Tidak ada transaksi kas yang dibuat.

## Verifikasi

`scripts/verify-finance.mjs` menjalankan adapter dan pipeline sebenarnya secara read-only serta hanya mencetak agregat dan diagnostik tersanitasi. Jalankan `npm test` terlebih dahulu agar modul verifikasi terkompilasi, lalu `node --conditions=react-server scripts/verify-finance.mjs`. Untuk penggunaan produksi, konfirmasi sumber tanggal aktual, jenis pendapatan, mata uang, koreksi/duplikat, harga dan volume, kebijakan alokasi, serta semantik margin.
