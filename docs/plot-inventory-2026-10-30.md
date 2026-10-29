# Inventaris petak dan cakupan periode

Verifikasi dilakukan read-only terhadap worksheet `New Version Overview` pada 30 Oktober 2026. Tidak ada perubahan pada spreadsheet. Repository masih membaca A–O dengan `FORMATTED_VALUE`; 15 header cocok dan nomor baris sumber tetap dipertahankan.

## Temuan dan cakupan

Nilai kolom B pada sumber mencakup **6 kode petak**: `22C/1A`, `45C/11`, `72A1/J54`, `72C/J54`, `72C1/J54`, dan `82C/J54`. Lima kode memiliki aktivitas bertanggal Oktober/November; `45C/11` memiliki enam baris sumber tanpa tanggal. Sebelumnya opsi kode dan daftar petak hanya dibangun dari baris bertanggal, dan periode awal dipilih sebagai November, sehingga `45C/11` tidak masuk daftar dan hanya satu petak aktif muncul pada November.

Inventaris kini dibangun dari semua kode valid, termasuk petak tanpa tanggal. Aktivitas periode tetap memerlukan kode dan tanggal valid serta bukan duplikat. Tidak ada nilai tanggal, solar, HM, atau status yang diisi otomatis pada baris lain.

- **Total Petak Terdaftar** menghitung seluruh kode valid pada sumber, tanpa mengikuti filter tanggal/status.
- **Petak dengan Aktivitas dalam Periode** dan KPI solar/HM/efisiensi tetap menggunakan aktivitas dalam filter, termasuk filter kode/status yang berlaku.
- Tabel memiliki opsi **Tampilkan semua petak terdaftar**. Filter kode/status tetap berlaku pada tabel. Petak tanpa aktivitas pada periode memiliki solar/HM N/A, bukan nol; baris yang ada tetapi tidak cocok filter status ditandai terpisah.
- Periode awal **Semua tanggal** mencakup semua aktivitas bertanggal yang tersedia. Pilihan bulan serta filter awal/akhir tetap tersedia. Bila tidak ada tanggal akhir, status inventaris menggunakan riwayat terbaru dari seluruh sumber, termasuk tanggal mendatang yang ada di sheet. Jika tanggal akhir dipilih, status hanya memakai tanggal sampai batas tersebut. Chart status tetap menggambarkan aktivitas dalam periode.
- Filter status aktivitas mempertahankan aturan Phase 2: status terakhir **dalam rentang**. Status inventaris memakai riwayat **sampai akhir rentang**. Karena itu petak bisa memiliki status historis yang diketahui meski tidak memiliki aktivitas dalam bulan terpilih.

## Metadata C dan D

Metadata dikelompokkan hanya berdasarkan kode B yang sama dan mempertahankan urutan serta referensi baris sumber. C/D kosong pada baris aktivitas tidak diisi ulang; kandidat metadata disimpan terpisah dalam inventaris. Jika suatu kode mempunyai satu nilai C atau D yang konsisten, kandidat beserta semua baris sumbernya tersedia di view model. Jika nilainya bertentangan atau invalid, nilainya tidak dipilih dan temuan dicatat. Metadata tanpa kode petak mendapat warning dan tidak dikaitkan ke petak lain. Tidak ada forward-fill pada kolom aktivitas.

Nilai C nol mendapat warning dan diperlakukan sebagai belum pasti; C negatif tetap error. Area yang bertentangan atau tidak pasti ditampilkan N/A. Angka D dipertahankan sebagai kandidat metadata kumulatif; D tidak dijumlahkan dan tidak digunakan untuk KPI pemakaian riil.

Metadata C/D yang teridentifikasi pada sampel live:

| Kode | Luas / sumber | D / sumber |
| --- | --- | --- |
| `72A1/J54` | 8,6 ha / C2 | 467 / D2 |
| `72C/J54` | 7,1 ha / C8 | 319 / D8 |
| `72C1/J54` | 0 / C12, perlu tinjauan | 410 / D12 |
| `82C/J54` | 0 / C16, perlu tinjauan | 0 / D16 |
| `22C/1A` | 22,2 ha / C18 | 457 / D18 |
| `45C/11` | 8,56 ha / C26 | belum tersedia |

Metadata merge Google yang dibaca secara read-only menunjukkan C dan D memang memiliki merged range vertikal. Adapter tetap menggunakan nilai A–O dan kode B, bukan mengasumsikan bahwa semua sel kosong merupakan merge. Penempatan metadata tidak menyeberang ke kode berbeda. Jika merge sumber nantinya mencakup beberapa kode, metadata hanya dikaitkan berdasarkan kode pada baris yang memiliki nilai; kode lain tidak menerima nilai secara otomatis dan nilai yang tidak tersedia tetap tercatat dalam kualitas data.

Untuk petak aktif pada KPI, luas berasal dari metadata seluruh sumber. Ini mengubah area yang sebelumnya N/A pada November menjadi **22,2 ha** dari C18. Pada Oktober/semua tanggal, total luas sebelumnya **37,9 ha** ketika dua nilai nol ikut dianggap valid; sekarang N/A karena dua nilai nol perlu ditinjau. Jumlah petak aktif, solar masuk, solar riil, HM, dan efisiensi tidak berubah ketika membandingkan filter periode yang sama.

## Status dan kualitas data

| Label sumber | Status dashboard |
| --- | --- |
| Mulai Garap Petak | Mulai pengerjaan |
| Garap Petak Berlangsung | Dalam pengerjaan |
| Garap Petak Selesai | Selesai |

Nilai lain tetap tidak diketahui dan menghasilkan temuan invalid. Status pada tanggal sama yang bertentangan tetap ambigu kecuali urutan entri sheet sudah dikonfirmasi. Pengukuran sumber tidak diperbaiki otomatis.

Dari 30 baris, 22 memenuhi syarat dasar aktivitas dan 8 tanpa tanggal dikecualikan. Verifikasi menghasilkan **109 temuan**: 11 error, 3 warning, dan 95 informasi. Error terdiri dari 8 tanggal kosong dan 3 stok tangki negatif; warning terdiri dari 2 luas nol serta 1 petak tanpa aktivitas bertanggal. Tidak ada 22 warning status tidak dikenal seperti pada baseline lama. Info mencakup missing value dan pasangan pengukuran yang belum tersedia. Baris aktivitas dengan stok negatif tidak dibuang dari metrik solar/HM yang valid.

| Cakupan | Petak aktif | Aktivitas | Solar masuk L | Solar riil L | HM jam | L/jam |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Semua tanggal | 5 | 22 | 1.760 | 2.117,4 | 220 | 9,6 |
| Oktober 2026 | 5 | 19 | 1.760 | 1.661,4 | 175 | 9,5 |
| November 2026 | 1 (`22C/1A`) | 3 | 0 | 456 | 45 | 10,1 |

Kelima nilai operasional pada filter Oktober dan November cocok dengan baseline sebelum perubahan; hanya metadata luas, daftar inventaris, dan normalisasi status yang berubah.

## Validasi

- `npm run lint`, `npm run typecheck`, dan `npm test`: PASS, 51 tes.
- `npm run build -- --webpack`: PASS. `npm run build` Turbopack masih gagal karena `binding to a port: Operation not permitted (os error 1)` pada runtime ini.
- `npm run verify:sheets`: PASS, pembacaan live dan pipeline, tanpa mencetak credentials atau raw rows.
- HTTP localhost pada snapshot live: PASS untuk 6 petak terdaftar, 5 aktif, 6 KPI sesuai engine, 6 baris tabel, opsi semua petak tercentang, pilihan semua tanggal/Oktober/November, dan tidak ada kecocokan credentials yang diperiksa pada payload.
- **Browser, interaksi checkbox/selector, mobile, dan hydration: NOT VERIFIED.** HTTP/SSR dan pengujian fungsi tidak membuktikan interaksi browser.

Rincian implementasi: `src/features/dashboard/lib/plot-inventory.ts` membangun inventaris dan provenance; normalizer/validator menangani status dan QA; view model memisahkan inventaris dari aktivitas; dashboard dan tabel menampilkan kedua cakupan; `tests/plot-inventory.test.ts` mencakup regresi sintetis. Google Sheets repository, rumus solar/HM/efisiensi, dan worksheet tidak diubah.
