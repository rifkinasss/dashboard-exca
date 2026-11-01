# Google Sheets: No. SPK dan sel kode petak yang digabung

Kontrak worksheet sekarang memiliki 16 kolom A–P. `No. SPK` berada di B; kode petak C, luas D, solar kumulatif E, tanggal F, HM kerja I, pengisian K, solar riil M, stok N, status O, dan keterangan P. Header harus cocok per posisi. Kode SPK disimpan sebagai teks sesuai nilai yang diformat Google Sheets; nol di depan tetap ada bila diberikan dalam format teks. Sel SPK kosong tetap kosong dan tidak mendiskualifikasi aktivitas.

Google Sheets dapat mengembalikan kode petak hanya pada sel pertama dari merge vertikal. Pembacaan metadata menyertakan rentang merge; kode hanya dipakai untuk sel kosong dalam merge satu kolom C yang valid dan tidak bertentangan. Data mentah tidak diubah. Nomor baris aktivitas dan sel kode petak asal disimpan terpisah, dan riwayat aktivitas menampilkan sumber tersebut. Tidak ada pengisian otomatis kolom SPK atau pengukuran operasional. Sel di luar merge atau merge lintas kolom tidak diberi kode otomatis.

Perhitungan solar, HM, efisiensi, dan aturan duplikat aktivitas tetap menggunakan bidang operasional sebelumnya; No. SPK belum menjadi kunci duplikat atau filter. Dua aktivitas yang identik pada seluruh bidang lama tetap diperlakukan sebagai duplikat meskipun No. SPK berbeda. Aturan ini perlu ditinjau jika bisnis menyatakan dua SPK dapat menandakan aktivitas terpisah yang kebetulan identik.

Verifikasi read-only pada 31 Oktober 2026 terhadap worksheet yang dikonfigurasi `Overview Operasional`: header A–P cocok; 21 baris sumber, 20 aktivitas bertanggal memenuhi syarat, lima kode petak. Lima belas baris aktivitas memiliki kode petak dari merge C yang eksplisit; satu baris tanpa kode petak dan tanggal dikecualikan. Hasil periode semua tanggal: solar masuk 1.930 L, solar riil 1.742,24 L, HM 188,5 jam, luas 49,5 ha. Data quality mencatat 6 error, 3 warning, dan 8 informasi, termasuk empat stok tangki negatif; perhitungan mengikuti aturan validasi yang ada. Snapshot dapat berubah seiring pembaruan sheet.

## Filter Nomor SPK

Nomor SPK tetap dinormalisasi sebagai teks. Nilai pada sel kosong hanya diwariskan dari sel awal rentang gabungan vertikal kolom B yang dikonfirmasi oleh metadata Google Sheets. Referensi baris aktivitas dan sel awal tetap tersimpan. Rentang yang tumpang tindih, tanpa nilai awal yang valid, atau berisi nilai bertentangan ditandai sebagai ambigu dan tidak dipakai; nilai SPK yang hilang tidak ditebak dari petak sebelumnya.

Pilihan SPK digabung dengan filter tanggal, petak, dan status. Daftar petak lengkap tetap disimpan sebagai inventaris sumber; ringkasan menampilkan petak yang terhubung dengan SPK yang dipilih, termasuk petak tanpa aktivitas dalam periode. Riwayat status dan aktivitas pada detail mengikuti cakupan SPK, sementara metadata luas tetap berasal dari inventaris sumber. Total petak terdaftar tetap menghitung seluruh inventaris. Target 60 ha tetap per bulan, dengan capaian sebagai kontribusi SPK terpilih.

Aturan duplikat aktivitas yang ada tidak membandingkan SPK: jika dua baris operasional identik memiliki SPK berbeda, hanya baris pertama yang dipakai dan panel kualitas data menandai duplikat beserta rujukan baris. Hal ini dapat membuat aktivitas duplikat tidak muncul ketika hanya SPK pada baris berikutnya dipilih; penyelesaian kepemilikan perlu pemeriksaan sumber, bukan penugasan otomatis.
