# Laporan Audit dan QA

Tanggal audit: 18 September 2026

Baseline: commit `f67ee69` (`Redesign wedding invitation experience`)

Status: remediasi diterapkan dan QA regresi lulus, tanpa blocker

## Ringkasan

Audit mencakup peninjauan HTML, CSS, JavaScript, konfigurasi Netlify dan Dev Container, serta QA interaktif menggunakan Chromium. Pengujian awal dilakukan pada viewport desktop `2160×1350`, mobile `390×844`, dan mobile kecil `319×640`. QA responsif lanjutan juga mencakup lebar efektif `319`, `390`, `739`, `922`, dan `1440` piksel.

Ditemukan dua isu prioritas tinggi, tiga isu prioritas menengah, dan dua isu prioritas rendah. Tidak ditemukan error JavaScript pada clean run, anchor internal rusak, ID duplikat, label form yang hilang, target interaksi di bawah 24 piksel, atau gambar gagal dimuat.

## Status Remediasi

Perbaikan diterapkan pada 18 September 2026 dengan status berikut:

| ID | Status | Perubahan |
| --- | --- | --- |
| AQ-01 | Selesai | Alamat dibaca melalui `innerText` agar pemisah `<br>` dipertahankan sebelum normalisasi. |
| AQ-02 | Selesai | Ukuran teks ringkasan acara, tombol, navigasi, dan musik dinaikkan pada mobile. |
| AQ-03 | Selesai | Nama tamu diberi `overflow-wrap: anywhere`. |
| AQ-04 | Sebagian | Open Graph, Twitter Card, dan favicon ditambahkan. `og:url` menunggu URL deployment resmi. |
| AQ-05 | Selesai | Grup foto diberi `role="group"`; label yang tidak diperlukan pada tanggal dihapus. |
| AQ-06 | Menunggu data | `DTEND` atau `DURATION` belum dapat ditambahkan karena waktu selesai acara tidak tercantum dalam spesifikasi. |
| AQ-07 | Selesai | Ornamen di bagian pasangan dibatasi ke section, root diberi fallback overflow untuk Android lama, dan grid RSVP dibuat fleksibel pada tablet. |

QA regresi lulus di Chromium pada lebar efektif `319`, `390`, `739`, `922`, dan `1440` piksel. Pada seluruh ukuran tersebut, lebar scroll root sama dengan lebar viewport dan percobaan scroll horizontal tetap di posisi `0`. Alamat clipboard serta `LOCATION` pada file `.ics` kini memiliki pemisah yang benar, nama tamu 80 karakter tetap dapat diakses pada layar terkecil, dan pemeriksaan Axe untuk `aria-prohibited-attr` tidak lagi menghasilkan temuan.

## Temuan

### AQ-01 — P1 — Alamat hasil salin dan kalender kehilangan spasi

Lokasi acara ditulis menggunakan `<br>` di `index.html`, lalu dibaca melalui `eventLocation.textContent` dan dirapikan oleh `normalizeText()` di `script.js`. `textContent` tidak menambahkan pemisah untuk `<br>`, sehingga clipboard dan file `.ics` menghasilkan:

```text
Jl. Nilam II, No. 5, RT/RW 04/010Jatiraden, JatisampurnaBekasi 17433
```

Dampak: alamat dari dua fungsi utama tamu tidak sama dengan alamat yang terlihat dan berpotensi lebih sulit dikenali aplikasi kalender atau peta.

Rekomendasi: simpan alamat dalam satu sumber data eksplisit, atau gunakan representasi teks yang mempertahankan pemisah baris sebelum dinormalisasi.

### AQ-02 — P2 — Teks penting terlalu kecil pada mobile

Pada viewport `390×844`, ukuran terhitung untuk beberapa elemen penting adalah:

- Label ringkasan acara: `9.12px`
- Nilai ringkasan acara: `12.16px`
- Tombol aksi utama: `11.84px`
- Navigasi tetap: `10.72px`
- Label musik: `11.52px`

Dampak: informasi inti dan navigasi lebih sulit dibaca, terutama bagi tamu berusia lanjut atau pengguna di luar ruangan.

Rekomendasi: naikkan ukuran teks informasi dan kontrol tanpa mengurangi tinggi target sentuh yang saat ini sudah memadai.

### AQ-03 — P2 — Nama tamu tanpa spasi dapat keluar dari kartu pembuka

Personalisasi membatasi nama hingga 80 karakter, tetapi `.guest-card strong` tidak memiliki aturan pemenggalan kata. Pengujian dengan 80 karakter tanpa spasi menghasilkan lebar teks sekitar `1258px` pada kartu selebar `340px`.

Dampak: query `?to=` tertentu dapat merusak tata letak pembuka di mobile.

Rekomendasi: tambahkan `overflow-wrap: anywhere` dan batas lebar yang mengikuti kartu.

### AQ-04 — P2 — Metadata preview media sosial belum tersedia

Dokumen memiliki title dan meta description, tetapi belum memiliki Open Graph atau Twitter Card, serta masih menggunakan favicon kosong.

Dampak: tautan yang dibagikan melalui WhatsApp dan platform sosial mungkin tidak menampilkan foto pasangan atau preview yang menarik.

Rekomendasi: tambahkan `og:title`, `og:description`, `og:image`, `og:type`, `og:url`, Twitter Card, dan favicon nyata.

### AQ-05 — P3 — `aria-label` digunakan pada elemen generik

Axe menandai dua elemen untuk pemeriksaan manual `aria-prohibited-attr`:

- `.mini-moments`
- `.event-date`

Keduanya berupa `<div>` tanpa role yang mendukung accessible name secara konsisten.

Rekomendasi: gunakan role semantik yang tepat apabila label grup memang dibutuhkan, atau hapus `aria-label` bila teks anak sudah cukup jelas.

### AQ-06 — P3 — Acara kalender tidak memiliki durasi

File `.ics` memiliki `DTSTART`, tetapi tidak memiliki `DTEND` atau `DURATION`.

Dampak: sebagian aplikasi kalender dapat menampilkan acara dengan durasi nol atau durasi default yang tidak jelas.

Rekomendasi: tambahkan waktu selesai setelah durasi resmi acara dikonfirmasi.

### AQ-07 — P1 — Ornamen dekoratif menyebabkan white space horizontal

Pseudo-element dekoratif pada `.couple` diposisikan di luar batas section dan ikut memperlebar area scroll dokumen. Pada browser Android tertentu, `overflow-x: clip` di `body` saja tidak cukup sebagai fallback sehingga halaman dapat bergeser ke kanan dan menampilkan bidang kosong. QA lanjutan juga menemukan grid RSVP masih mempertahankan lebar minimum desktop pada ukuran tablet.

Dampak: halaman terlihat tidak responsif, memiliki white space di sisi kanan, dan form RSVP dapat terpotong pada lebar sekitar `922px`.

Remediasi: batasi ornamen pada `.couple`, tambahkan fallback `overflow-x: hidden` sebelum `clip` pada root dan body, serta gunakan kolom fleksibel untuk RSVP pada breakpoint tablet.

## Pengujian yang Lulus

- Personalisasi melalui `?to=` dan `?guest=`.
- Input personalisasi dimasukkan sebagai teks; payload HTML tidak dieksekusi.
- Gate pembuka, penguncian halaman, `inert`, dan perpindahan fokus.
- Musik dimuat setelah gestur pengguna dan tombol aktif/mati bekerja.
- Preferensi `prefers-reduced-motion` ditangani.
- Navigasi anchor dan pembaruan `aria-current`.
- Google Maps mengarah ke Rumah SugiNiyah di alamat acara.
- Pembuatan dan pengunduhan file kalender.
- Salin nomor rekening.
- Galeri, dialog lightbox, tombol Escape, dan pemulihan fokus.
- Validasi wajib RSVP.
- Kondisi jumlah tamu untuk pilihan hadir/tidak hadir.
- State mengirim, sukses, dan gagal pada RSVP.
- Semua 15 gambar yang direferensikan berhasil dimuat.
- Tidak ada ID duplikat, anchor internal hilang, field tanpa label, atau tombol tanpa `type`.
- Tidak ada scroll horizontal pada lebar efektif `319`, `390`, `739`, `922`, dan `1440` piksel; grid RSVP tidak lagi terpotong pada tablet.
- Axe: 28 pemeriksaan lulus dan tidak ada pelanggaran otomatis yang terkonfirmasi. Kontras pada teks di atas gambar tetap memerlukan penilaian manual.

## Catatan Kinerja

- Audio berukuran sekitar `4.2MB` dan tidak dipreload sebelum undangan dibuka.
- Total seluruh file aset dalam repository sekitar `6.9MB`.
- Lima gambar sekitar `563KB` tidak lagi direferensikan oleh halaman. File tersebut tidak menambah payload runtime, tetapi dapat dibersihkan dari repository bila tidak diperlukan lagi.

## Batasan Pengujian

- QA menggunakan server statis lokal karena repository belum memiliki task atau service preview Ona.
- Respons sukses dan gagal RSVP diuji dengan mock HTTP; penerimaan submission pada backend Netlify produksi belum diverifikasi.
- Pengujian browser dilakukan di Chromium; Safari dan Firefox belum diuji.
- Preview WhatsApp atau platform sosial belum diuji karena metadata Open Graph belum tersedia.

## Verifikasi Revisi — 29 September 2026

Revisi berdasarkan `spec.md` telah diterapkan dan diperiksa di Chromium melalui preview statis lokal. Cakupan: lokasi pembuka/hero dan metadata, gelar Adam serta Instagram, MP3 I Got Mine, label Akad & Syukuran, foto acara `gallery-6.webp`, dua rekening dengan angka lebih kecil, dan panduan berbagi terpisah.

Hasil verifikasi:

- Lebar 320, 390, 768, 1024, dan 1440 px: tidak ada overflow horizontal atau teks baru terpotong. Nomor rekening berukuran 24–32 px; tautan Instagram memiliki tinggi target 44 px dan tombol salin 50 px.
- Personalisasi default, nilai kosong, `?to=`, `?guest=`, nama dengan spasi/ampersand, emoji, 80 karakter tanpa spasi, dan teks menyerupai HTML lulus. Nama tetap menjadi teks dan membungkus pada layar 320 px.
- MP3 lokal berukuran 3.683.672 byte, durasi sekitar 238,98 detik. Tidak ada permintaan MP3 sebelum pembukaan; playback setelah interaksi dan pause/resume lulus. Penolakan playback serta kegagalan permintaan audio disimulasikan dan tidak menghalangi pembukaan/navigasi.
- Clipboard nyata menyalin BCA `7401662727` dan BNI `1229896497` dengan benar. Feedback serta timer kedua kartu independen. Fallback ketika Clipboard API tidak tersedia lulus; kegagalan API dan fallback menampilkan petunjuk manual tanpa label sukses tersisa.
- File kalender berhasil diunduh dengan nama `Adam-Nadhila-26-12-2026.ics`, waktu `20261226T020000Z`, gelar Adam yang diperbarui, dan alamat dengan pemisah yang benar. Tujuan Maps tetap sesuai sumber sebelumnya. Perilaku kalender pada checkout dipertahankan; tidak mengimpor perubahan kalender dari situs publik.
- Keenam lightbox dapat dibuka dan ditutup dengan Escape; fokus kembali ke pemicu. Gate dapat dibuka dengan Enter dan memindahkan fokus ke judul. Kedua tautan Instagram menampilkan outline saat berpindah menggunakan Tab/Shift+Tab; tombol salin dapat diaktifkan dengan Enter.
- Mode reduced motion, nama wajib pada RSVP, serta perubahan jumlah tamu berdasarkan kehadiran lulus tanpa mengirim form ke produksi.
- Seluruh 14 elemen gambar dengan sumber tetap berhasil dimuat pada pemeriksaan akhir. Tidak ada error JavaScript atau respons aset lokal gagal pada pemuatan bersih.
- Pemeriksaan statis memastikan ID unik, seluruh referensi aset lokal tersedia, dan `git diff --check` lulus. Markup story, galeri, RSVP, dan penutup identik dengan baseline.
- Pemeriksaan visual desktop/mobile memastikan foto acara menampilkan wajah di atas blok tanggal, lokasi panjang tetap terbaca, dan kedua kartu bank tersusun sesuai spesifikasi. Urutan lapisan foto hero mobile diperbaiki agar overlay berada di atas foto dan teks lokasi memiliki kontras yang memadai.

Template WhatsApp tersedia di `PANDUAN-UNDANGAN.md` dengan contoh penerima dan tautan yang cocok. Pesan tidak dikirim otomatis.

Batas pengujian: Chromium saja; Safari/Firefox, preview WhatsApp, dan penerimaan RSVP oleh backend produksi tidak diverifikasi. Preview memakai server statis lokal karena lingkungan belum memiliki service/task preview proyek. Gangguan proses preview awal diperbaiki sebelum pemuatan bersih terakhir. Tidak ada deployment produksi pada tahap ini.
