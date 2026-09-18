# Laporan Audit dan QA

Tanggal audit: 18 September 2026

Baseline: commit `f67ee69` (`Redesign wedding invitation experience`)

Status: layak dilanjutkan, tanpa blocker

## Ringkasan

Audit mencakup peninjauan HTML, CSS, JavaScript, konfigurasi Netlify dan Dev Container, serta QA interaktif menggunakan Chromium. Pengujian dilakukan pada viewport desktop `2160×1350`, mobile `390×844`, dan mobile kecil `319×640`.

Ditemukan satu isu prioritas tinggi, tiga isu prioritas menengah, dan dua isu prioritas rendah. Tidak ditemukan error JavaScript pada clean run, anchor internal rusak, ID duplikat, label form yang hilang, target interaksi di bawah 24 piksel, atau gambar gagal dimuat.

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
