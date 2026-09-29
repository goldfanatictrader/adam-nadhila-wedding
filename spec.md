# Spesifikasi Revisi Undangan Adam & Nadhila

## 1. Status dan tujuan

**Status: Implementasi selesai; verifikasi lokal lulus pada 29 September 2026.**

Disusun pada 29 September 2026 dari catatan review halaman 1–10, enam gambar referensi pengguna, pemeriksaan sumber proyek, dan peninjauan situs publik melalui browser.

Tujuan pekerjaan adalah menerapkan revisi konten dan interaksi yang diminta pada undangan yang sudah ada, dengan mempertahankan desain romantis, susunan cerita, dan bagian yang telah disetujui. Dokumen ini menggantikan spesifikasi redesign terdahulu sebagai acuan pekerjaan berikutnya; redesign tersebut sudah menjadi baseline, bukan pekerjaan yang perlu diulang.

Pada tahap perencanaan, perubahan terbatas pada `spec.md`. Setelah pengguna meminta implementasi, revisi diterapkan pada kode aplikasi, aset audio, dan panduan berbagi. Keputusan final pada bagian 10 menjadi acuan. Konfigurasi hosting tidak diubah dan situs produksi belum diterbitkan ulang. Hasil verifikasi dicatat di bagian 11.

## 2. Sumber dan baseline terverifikasi

- Situs yang direview: [Undangan Adam & Nadhila](https://adam-nadhila-wedding.pages.dev/).
- Referensi wording dan nama penerima: [Undangan Ilna & Farid](https://eenvited.com/ilna-farid?to=Nadilla%20Tersayang%F0%9F%A4%8D). Referensi ini tidak menjadi sumber nama pasangan, tanggal, rekening, foto, atau lokasi untuk undangan Adam & Nadhila.
- Penomoran halaman pengguna merujuk pada bagian sebuah halaman panjang, bukan sepuluh route terpisah.
- Proyek berupa situs statis tanpa framework, package manager, bundler, atau perintah build aplikasi.
- `index.html`: markup seluruh undangan, informasi acara, form RSVP, audio, rekening, serta metadata preview.
- `styles.css`: tata letak responsif, tipografi, dekorasi, dan gambar latar acara.
- `script.js`: personalisasi nama, pembukaan undangan, musik, navigasi, kalender, clipboard, galeri, dan RSVP.
- Baseline `assets/` berisi foto WebP dan audio `porcelain_and_teak.mp3`. Implementasi menambahkan `paul-partohap-i-got-mine.mp3` dari sumber pengguna dan menggunakannya sebagai musik undangan.
- `AUDIT-QA.md`: catatan QA historis, termasuk perbaikan overflow, personalisasi, dan alamat kalender; bukan bukti pengujian revisi ini.
- Repo memiliki konfigurasi Netlify dan form Netlify. Situs review memakai domain Cloudflare Pages. Jangan mengasumsikan backend RSVP produksi telah berfungsi hanya karena markup form ada; penerimaan RSVP produksi belum diverifikasi.
- Situs publik menampilkan tombol `Simpan ke Kalender` dan `Unduh file kalender (.ics)`, sementara checkout ini hanya memiliki tombol pertama yang mengunduh ICS. Saat implementasi, periksa perbedaan ini dan pertahankan perilaku kalender pada basis kode yang dipakai tanpa melakukan migrasi hosting.

### Fakta acara yang tetap menjadi acuan

| Informasi | Nilai |
| --- | --- |
| Pasangan | Adam & Nadhila |
| Nama lengkap Adam sesudah revisi | Adam Alfiansyah S.H |
| Nama lengkap Nadhila | Nadhila Rachmawati, S.Psi. |
| Hari dan tanggal | Sabtu, 26 Desember 2026 |
| Waktu mulai | 09.00 WIB |
| Jenis acara sesudah revisi | Akad & Syukuran |
| Nama lokasi | Kediaman Mempelai Wanita |
| Alamat | Jl. Nilam II, No. 5, RT/RW 04/010, Jatiraden, Jatisampurna, Bekasi 17433 |
| Google Maps | https://maps.app.goo.gl/tYcqEJPrFE5dXKF79 |
| Instagram Adam | @adam.alfiansyah |
| Instagram Nadhila | @nadhilarchmwt |
| Pemilik kedua rekening | Nadhila Rachmawati |
| BCA | 7401662727 |
| BNI | 1229896497 |

Tanggal 23 Agustus 2026 dan nama Ilna/Farid hanya milik contoh. Jangan memindahkannya ke konten atau kalender Adam & Nadhila. Nama orang tua dan alamat lengkap tetap mengikuti sumber proyek. Waktu selesai acara belum diberikan; jangan membuat durasi baru.

## 3. Pemetaan review ke kebutuhan

| Review | Bagian proyek | Kebutuhan |
| --- | --- | --- |
| Halaman 1 | `#gate`, `.gate-date`, `#guestName` | Ganti label BEKASI menjadi Kediaman Mempelai Wanita; dokumentasikan cara memberi nama tamu. |
| Halaman 2 | `#beranda`, `.quick-facts`, `#bgMusic` | Ganti label lokasi menjadi Kediaman Mempelai Wanita; ganti musik ke Paul Partohap — I Got Mine dari MP3 yang diberikan pengguna. |
| Halaman 3 | `#couple`, `.person-card` | Tambahkan gelar Adam dan tautan Instagram kedua pasangan. |
| Halaman 4–6 | `#story` beserta kedua bab | Pertahankan konten, foto, urutan, dan komposisi yang disetujui. |
| Halaman 7 | `#event`, `.event-time`, `.event-date` | Ubah Akad & Resepsi menjadi Akad & Syukuran; ganti latar `horizon-4.webp` dengan `gallery-6.webp`. |
| Halaman 8 | `#gallery` | Pertahankan komposisi, enam foto, dan lightbox. Penggantian foto acara tidak otomatis mengganti galeri. |
| Halaman 9 | `#gift`, `.bank-card` | Perkecil nomor rekening dan tampilkan BCA serta BNI dengan tombol salin masing-masing. |
| Halaman 10 | `.closing` | Pertahankan penutup yang sudah disetujui. |
| Contoh pesan undangan | `PANDUAN-UNDANGAN.md` | Buat template pesan WhatsApp terpisah beserta panduan tautan personal. |

RSVP tidak menerima permintaan perubahan dalam review ini dan tetap dipertahankan.

## 4. Persyaratan fungsional dan konten

### REQ-01 — Lokasi di pembuka dan ringkasan

1. Ganti label singkat `BEKASI` pada pembuka serta `Bekasi` pada ringkasan hero menjadi `Kediaman Mempelai Wanita`.
2. Izinkan label yang lebih panjang membungkus secara alami pada mobile. Jangan mengecilkan tanggal, tombol, atau teks lokasi sampai sulit dibaca.
3. Pertahankan kata Bekasi pada alamat pos lengkap. Penggantian bukan pencarian/penggantian global seluruh kota.
4. Selaraskan meta description, Open Graph description, dan Twitter description menjadi informasi tempat yang sama, misalnya: `Undangan pernikahan Adam dan Nadhila, Sabtu 26 Desember 2026 di Kediaman Mempelai Wanita, Bekasi.`
5. Pertahankan foto preview, judul pasangan singkat, URL Maps, dan alamat yang sudah benar.

### REQ-02 — Nama penerima dan panduan berbagi

Personalisasi sudah tersedia melalui `URLSearchParams` di `personalizeGuest()`; kebutuhan utama adalah petunjuk pemakaian, bukan fitur baru yang harus dibangun dari awal.

- Parameter utama: `?to=...`; `?guest=...` tetap didukung sebagai kompatibilitas.
- Contoh tautan satu orang: `https://adam-nadhila-wedding.pages.dev/?to=Bapak%20Budi`.
- Contoh pasangan: `https://adam-nadhila-wedding.pages.dev/?to=Bapak%20Budi%20%26%20Ibu%20Sari`.
- Contoh dengan emoji: `https://adam-nadhila-wedding.pages.dev/?to=Nadilla%20Tersayang%F0%9F%A4%8D`.
- Nilai query adalah seluruh sapaan yang akan tampil, misalnya `Bapak Budi & Ibu Sari`, tepat di bawah `Kepada Yth.`. Nama penerima bukan nama mempelai.
- Ubah hanya nilai `to` untuk setiap tamu, lalu bagikan tautan tersebut. Pengeditan HTML dan deployment per tamu tidak diperlukan.
- Gunakan `encodeURIComponent` atau `URL.searchParams.set` saat membentuk tautan agar spasi, `&`, `+`, `#`, dan emoji tidak merusak query. Jangan meminta pengguna menambahkan karakter `&` mentah di dalam nilai.
- Tanpa nama atau dengan nilai kosong, sapaan tetap `Bapak/Ibu/Saudara/i`.
- Pertahankan pemasukan nama melalui `textContent`, batas 80 karakter yang sudah ada, dan pembungkusan nama panjang.
- Jangan menambahkan database tamu, login, generator massal, atau penyimpanan nama tamu untuk kebutuhan ini.
- Sertakan petunjuk ringkas dan contoh siap salin dalam dokumen panduan berbagi pada tahap implementasi; petunjuk teknis tidak ditempatkan di halaman tamu.

### REQ-03 — Musik

- Lagu tujuan: **Paul Partohap — I Got Mine**.
- Sumber yang dipilih pengguna: [Paul Partohap — I GOT MINE (Official Audio).mp3](https://github.com/goldfanatictrader/adam-nadhila-wedding/raw/refs/heads/main/Paul%20Partohap%20-%20I%20GOT%20MINE%20(Official%20Audio).mp3).
- Pemeriksaan HTTP pada tahap perencanaan memperoleh status `200` dan tipe `audio/mpeg` setelah mengikuti redirect. Pada implementasi, MP3 berukuran 3.683.672 byte berhasil diputar di Chromium dengan durasi sekitar 239 detik; pause/resume serta skenario kegagalan juga diverifikasi.
- Saat implementasi, ambil MP3 dari sumber di atas dan simpan sebagai `assets/paul-partohap-i-got-mine.mp3`, lalu arahkan `#bgMusic` ke aset lokal tersebut. Browser tamu memuatnya dari hosting undangan, bukan langsung dari GitHub.
- Jangan menimpa nama aset lama untuk menghindari cache immutable. Gunakan rekaman yang diberikan tanpa memotong atau mengganti versinya.
- Pertahankan satu pemutar, `loop`, `preload="none"`, dan volume awal yang ada.
- Musik baru mulai dicoba setelah pengguna menekan `Buka Undangan`; tombol aktif/mati tetap berlaku di seluruh undangan.
- Pause/resume melanjutkan posisi lagu. Label tombol dan `aria-pressed` sesuai kondisi pemutaran.
- Kegagalan memuat atau memutar lagu tidak menghalangi pembukaan halaman, navigasi, atau RSVP.
- Jangan mengklaim penggantian selesai bila file baru belum tersedia dan diuji.

### REQ-04 — Nama dan Instagram

- Tampilkan nama Adam pada profil sebagai `Adam Alfiansyah S.H`, mengikuti ejaan yang diberikan pengguna.
- Pertahankan `Nadhila Rachmawati, S.Psi.` serta semua nama orang tua.
- Nama singkat dekoratif `Adam & Nadhila` pada pembuka, hero, dan penutup tetap sesuai desain.
- Tambahkan tautan teks yang jelas pada kartu masing-masing pasangan:
  - `@adam.alfiansyah` → `https://www.instagram.com/adam.alfiansyah/`.
  - `@nadhilarchmwt` → `https://www.instagram.com/nadhilarchmwt/`.
- Tautan dapat diakses dengan keyboard, memiliki fokus terlihat, dan membuka tab baru dengan `rel="noopener noreferrer"`. Ikon boleh menjadi aksen, tetapi handle tetap terbaca.
- Tidak perlu embed feed Instagram atau memuat SDK sosial.
- Selaraskan nama lengkap Adam di deskripsi file kalender; pertahankan tanggal, waktu, dan lokasi kalender.

### REQ-05 — Jenis acara dan foto

- Tampilkan label acara `AKAD & SYUKURAN` melalui teks `Akad & Syukuran` dan gaya kapital yang sudah ada.
- Hapus penyebutan Resepsi dari copy acara yang direvisi; jangan menambahkan slot resepsi terpisah.
- Pertahankan 09.00 WIB, tanggal, alamat, Google Maps, tombol kalender, dan salin alamat.
- Foto saat ini berada di CSS `.event-date`, menggunakan `assets/horizon-4.webp` sebagai latar. Penggantian hanya berlaku untuk panel tanggal acara.
- Foto pengganti yang telah dipilih pengguna: **`assets/gallery-6.webp`**, foto berdiri pada bingkai batu berlatar laut. Keduanya menghadap arah yang sama tanpa pose berpelukan; pengguna menerima foto ini meskipun keduanya tidak menatap langsung kamera.
- Pertahankan keterbacaan angka tanggal dengan overlay; sesuaikan crop per breakpoint agar wajah tidak terpotong atau tertutup angka.
- Gunakan kembali berkas `gallery-6.webp` tanpa mengubah isinya. Pemakaian foto yang sama di galeri tetap dipertahankan; `horizon-4.webp` tidak perlu dihapus.
- Tidak diperlukan foto baru atau perubahan wajah/pose dengan AI.

### REQ-06 — Dua rekening dan ukuran angka

| Urutan | Bank | Nomor persis untuk tampilan dan clipboard | Pemilik |
| --- | --- | --- | --- |
| 1 | BCA | `7401662727` | a.n. Nadhila Rachmawati |
| 2 | BNI | `1229896497` | a.n. Nadhila Rachmawati |

- Tampilkan dua kartu rekening pada bagian Tanda Kasih, tanpa mengubah wording pengantar yang disetujui.
- Pada desktop, pertahankan pengantar di kiri dan kelompok dua kartu tersusun vertikal di kanan. Pada mobile, pengantar diikuti kedua kartu dalam satu kolom.
- Gunakan nomor sekitar 24–32 CSS px pada ukuran root 16 px, lebih kecil dari implementasi lama yang dapat mencapai sekitar 70 px. Nomor lengkap harus terlihat, terbaca, dan tidak terpotong pada lebar 320 px.
- Masing-masing kartu memiliki bank, nomor, pemilik, tombol `Salin Nomor Rekening`, dan area feedback sendiri.
- Accessible name tombol membedakan bank, misalnya `Salin Nomor Rekening BCA` dan `Salin Nomor Rekening BNI`.
- Tombol hanya menyalin angka rekening kartu yang dipilih; tidak menyalin bank, nama, spasi tambahan, atau nomor rekening lain.
- Feedback sukses/gagal ditampilkan dalam kartu terkait melalui `role="status"` / `aria-live="polite"`.
- Pertahankan dukungan clipboard fallback yang ada serta petunjuk menyalin manual bila gagal.
- Gunakan ID unik atau selector berbasis kartu; jangan menggandakan ID `accountNumber`, `copyAccount`, atau `copyStatus`.
- Pertahankan latar, warna, tipografi, dan nuansa lengkung kartu; sesuaikan padding agar dua kartu tidak terlalu tinggi.

### REQ-07 — Wording undangan

Pengguna memilih **template pesan WhatsApp terpisah**. Pada tahap implementasi, tambahkan `PANDUAN-UNDANGAN.md` yang berisi panduan tautan dari REQ-02 serta template berikut. Template siap disalin secara manual setelah dua placeholder penerima dan tautan diganti; placeholder tersebut adalah isian setiap pengiriman, bukan keputusan produk yang tertunda.

- Gunakan nama dan tanggal Adam & Nadhila, bukan data contoh Ilna & Farid.
- Nama dalam pesan dan nilai `to` pada tautan harus mengacu pada penerima yang sama.
- Pertahankan nada sopan dan Islami dari contoh, dengan ejaan yang dirapikan dan tanpa pengulangan ucapan terima kasih yang tidak diperlukan.
- Jangan otomatis mengirim pesan WhatsApp atau menambahkan pengiriman massal.
- Pengantar dan salam pada situs tetap mengikuti copy yang ada; template panjang berada di dokumen panduan.

Template yang menjadi acuan implementasi:

```text
Assalamualaikum Warahmatullahi Wabarakatuh

Kepada Yth.
[Sapaan dan Nama Tamu]

Dengan memohon ridho dan rahmat Allah SWT, tanpa mengurangi rasa hormat, izinkan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara akad dan syukuran pernikahan kami:

Adam Alfiansyah S.H
&
Nadhila Rachmawati, S.Psi.

Insya Allah akan dilaksanakan pada:
Sabtu, 26 Desember 2026
Pukul 09.00 WIB
Kediaman Mempelai Wanita

Informasi lengkap acara dapat dilihat melalui tautan undangan berikut:
[Tautan Undangan Personal]

Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.

Mohon maaf atas keterbatasan jarak dan waktu. Undangan elektronik ini bersifat resmi dan bernilai sama dengan undangan fisik.

Terima kasih atas perhatian dan doa restu Bapak/Ibu/Saudara/i.

Wassalamualaikum Warahmatullahi Wabarakatuh
```

Contoh pengisian yang konsisten: `[Sapaan dan Nama Tamu]` menjadi `Bapak Budi & Ibu Sari`, dan `[Tautan Undangan Personal]` menjadi `https://adam-nadhila-wedding.pages.dev/?to=Bapak%20Budi%20%26%20Ibu%20Sari`. Sertakan contoh lengkap dalam panduan untuk memastikan kedua isian tidak tertukar.

## 5. Batasan dan hal yang dipertahankan

1. Pertahankan arsitektur statis dan tiga berkas utama; tidak menambahkan framework, build pipeline, backend, CMS, database, atau dependency runtime baru.
2. Perubahan terarah pada review ini; halaman 4, 5, 6, 8, dan 10 tetap mengikuti desain, foto, dan copy yang disetujui.
3. Gunakan bahasa Indonesia untuk informasi dan kontrol penting; aksen bahasa Inggris dekoratif yang ada boleh tetap.
4. Pertahankan native scrolling, navigasi bawah, reduced motion, penguncian/inert pada gate, pengelolaan fokus, dan lightbox.
5. Jangan mengubah skema form RSVP, nama field, validasi, atau integrasi hosting sebagai bagian revisi ini.
6. Jangan mengubah nomor rekening, nama pemilik, alamat, tanggal, atau jam berdasarkan inferensi.
7. Tidak menambahkan jadwal selesai, hitung mundur baru, sistem kado, pembayaran, atau QR rekening.
8. Pertahankan koreksi overflow dan pembacaan alamat dari audit terdahulu.
9. Pastikan label lokasi panjang, gelar, handle Instagram, dan kartu kedua tidak menimbulkan overflow pada 320, 390, 768, 1024, dan 1440 px.
10. Kontrol baru tetap punya target sentuh minimal 44 px, fokus terlihat, serta feedback yang terbaca pembaca layar. Overlay foto harus menjaga kontras teks.
11. Audio tidak diunduh sebelum interaksi membuka undangan. Foto tetap memakai WebP dan pola lazy loading yang sesuai.
12. Tahap perencanaan tidak mencakup implementasi, commit, PR, atau publikasi situs.

## 6. Arsitektur perubahan yang direncanakan

### `index.html`

Perbarui label lokasi dan metadata; nama lengkap pada profil; tautan Instagram; label jenis acara; sumber audio ke `assets/paul-partohap-i-got-mine.mp3`; serta markup dua kartu rekening. Pertahankan landmark, anchor, ID bagian halaman, dan form RSVP.

Simpan nomor rekening sebagai teks pada kartu masing-masing, sehingga tampilan dan sumber clipboard tidak memiliki dua nilai yang dapat berbeda. Gunakan kelas bersama untuk nomor, tombol, dan status; kaitkan semuanya pada kartu terdekat.

### `styles.css`

Perubahan terbatas pada pembungkusan label gate/ringkasan, tautan profil, gambar latar/crop `.event-date` ke `assets/gallery-6.webp`, kelompok kartu bank, dan skala nomor rekening. Gunakan Grid/Flexbox dan token visual yang ada. Periksa seluruh override media query agar aturan lama `.bank-card strong` di mobile tidak membesarkan kembali nomor.

### `script.js`

- Pertahankan `personalizeGuest()` serta alur gate dan musik yang sudah memenuhi kebutuhan.
- Ubah `initializeGiftCopy()` dari selector tunggal global menjadi inisialisasi per kartu. Ambil nomor, tombol, dan status dari kartu yang sama; gunakan `copyText()` yang sudah ada.
- Kelola feedback dan timer reset tombol secara terpisah per kartu agar klik berurutan tidak saling mengubah state.
- Selaraskan deskripsi nama lengkap dalam `downloadCalendar()`; pertahankan escaping ICS dan `DTSTART:20261226T020000Z` yang setara 09.00 WIB.
- Jangan melakukan refactor interaksi lain yang tidak diperlukan oleh review.

### Aset dan dokumentasi

- Tambahkan `assets/paul-partohap-i-got-mine.mp3` dari sumber pengguna; foto acara menggunakan kembali `assets/gallery-6.webp` tanpa membuat aset gambar baru.
- Tambahkan `PANDUAN-UNDANGAN.md` untuk petunjuk tautan personal, template WhatsApp, dan contoh pengisian lengkap dari REQ-07. File panduan baru dibuat pada tahap implementasi.
- Perbarui versi query stylesheet/script ketika kode berubah agar peninjauan tidak memakai cache lama.
- Pada tahap perencanaan, spec adalah satu-satunya berkas yang berubah. Perubahan implementasi mengikuti pembagian berkas di atas.

## 7. Langkah implementasi

1. **Siapkan basis implementasi dan audio.** Periksa perbedaan kalender checkout dengan situs publik; ambil MP3 dari tautan yang telah diberikan, pastikan berkas merupakan audio yang dapat diputar, lalu simpan dengan nama aset yang ditentukan. Pilihan template dan foto sudah final dan tidak perlu ditanyakan ulang.
2. **Terapkan revisi teks dan profil.** Ubah label lokasi, metadata, nama Adam, Instagram, dan jenis acara; selaraskan nama dalam ICS. Periksa kembali seluruh angka dan ejaan terhadap tabel fakta.
3. **Integrasikan musik dan foto acara.** Sambungkan `#bgMusic` ke MP3 lokal dan ubah latar `.event-date` ke `gallery-6.webp`; atur crop/overlay tanpa memengaruhi story, galeri, atau penutup.
4. **Perbarui Tanda Kasih.** Buat kelompok dua kartu, kecilkan tipografi rekening, serta ubah penanganan clipboard dan feedback menjadi per kartu.
5. **Selesaikan petunjuk berbagi.** Buat `PANDUAN-UNDANGAN.md` berisi cara memakai `?to=`, contoh nama berpasangan/emoji, template WhatsApp REQ-07, dan contoh pesan lengkap dengan penerima serta tautan yang cocok.
6. **Verifikasi dan serahkan hasil.** Jalankan pemeriksaan konten, responsivitas, musik, tautan, clipboard, kalender, serta regresi terbatas alur undangan. Catat hasil aktual dan batas pengujian; jangan mengklaim deployment atau penerimaan RSVP produksi tanpa bukti.

## 8. Rencana verifikasi

Matriks di bawah menjadi acuan pengujian implementasi. Hasil aktual dan batas pengujian dicatat pada bagian 11 serta `AUDIT-QA.md`.

| Area | Pemeriksaan | Hasil yang diharapkan |
| --- | --- | --- |
| Konten | Bandingkan halaman dan metadata dengan tabel fakta | Lokasi, nama/gelar, acara, handle, serta kedua rekening persis sesuai permintaan. |
| Nama tamu | Tanpa query, `?to=`, `?guest=`, nama berspasi, ampersand ter-encode, emoji, 80 karakter, teks menyerupai HTML | Nama tampil aman sebagai teks; fallback bekerja; nama panjang membungkus; tidak ada eksekusi markup. |
| Instagram | Periksa href dan aktivasi keyboard | Masing-masing handle menuju profil yang benar, fokus terlihat, rel aman. |
| Musik | Verifikasi MP3 pengguna; buka gate, pause, resume, blokir playback atau gagalkan permintaan audio | I Got Mine diputar dari aset lokal setelah interaksi, state akurat, undangan tetap dapat digunakan saat gagal. |
| Foto acara | Desktop dan mobile | Panel acara memakai `gallery-6.webp`; kedua wajah dan tanggal terbaca; foto serta komposisi galeri tetap. |
| Rekening | Salin BCA lalu BNI, ulangi cepat, Clipboard API tidak tersedia, clipboard gagal | Angka yang disalin tepat; feedback/timer setiap kartu independen; kegagalan dijelaskan tanpa feedback sukses palsu. |
| Tata letak | 320×568, 390×844, 768×1024, 1024×768, 1440×900 | Tidak ada overflow horizontal, teks/nomor terpotong, atau kontrol tertutup navigasi tetap. |
| Kalender dan Maps | Periksa tujuan Maps dan isi ICS | Tanggal/jam/alamat tetap benar; gelar Adam diperbarui; tidak ada durasi karangan. |
| Bagian disetujui | Bandingkan story, galeri, penutup | Komposisi, foto, dan isi tetap; keenam lightbox berfungsi. |
| Template WhatsApp | Isi contoh penerima dan tautan, lalu buka tautan tanpa mengirim pesan | Data acara tepat; nama dalam pesan cocok dengan sapaan pembuka; template berada di panduan terpisah. |
| Aksesibilitas | Keyboard, fokus, reduced motion, status, ID unik | Alur gate, tautan baru, dan dua tombol salin dapat digunakan; status terkait kartu yang benar. |
| Regresi RSVP | Validasi form dan pilihan hadir/tidak hadir secara lokal | Perilaku lama tetap; tidak mengirim data percobaan ke produksi. |
| Pemuatan | Periksa konsol dan permintaan aset | Tidak ada error baru atau aset lokal 404; audio tidak dipreload sebelum interaksi. |

Gunakan pemeriksaan browser terarah dan validasi statis yang tersedia. Tidak perlu menambahkan framework test atau rangkaian test yang hanya memeriksa literal teks. Sebelum menjalankan preview lokal pada tahap implementasi, periksa workflow lingkungan yang tersedia.

## 9. Kriteria sukses

Revisi dinyatakan selesai apabila:

1. Seluruh perubahan pada halaman 1, 2, 3, 7, dan 9 terlihat sesuai keputusan final, sedangkan halaman yang disetujui tetap terjaga.
2. Pengguna dapat membuat tautan untuk penerima baru dari panduan tanpa mengedit/deploy aplikasi, dan tautan tersebut menampilkan nama yang benar.
3. Lagu Paul Partohap — I Got Mine dari sumber pengguna tersedia sebagai `assets/paul-partohap-i-got-mine.mp3` dan lolos uji playback setelah interaksi, pause, resume, serta kegagalan pemutaran.
4. Panel tanggal acara memakai `gallery-6.webp` sesuai pilihan pengguna, dengan wajah dan angka tanggal terbaca pada desktop/mobile, tanpa mengubah pemakaian foto tersebut di galeri.
5. BCA `7401662727` dan BNI `1229896497`, keduanya a.n. Nadhila Rachmawati, terbaca dengan ukuran lebih kecil dan dapat disalin secara independen.
6. `PANDUAN-UNDANGAN.md` memuat template WhatsApp terpisah dengan data Adam & Nadhila, petunjuk nama tamu, serta contoh tautan yang dapat dibuka dan menampilkan penerima yang sesuai.
7. Pemeriksaan responsif dan alur utama pada bagian 8 lulus tanpa regresi baru; batas verifikasi backend produksi dinyatakan secara akurat.

Dokumen perencanaan lengkap setelah seluruh keputusan berikut tercatat, semua kebutuhan terpetakan ke langkah dan kriteria sukses, serta perubahan workspace pada tahap ini terbatas pada `spec.md`. Kelengkapan rencana tidak menyatakan bahwa implementasi atau pengujian aplikasinya sudah dilakukan.

## 10. Keputusan klarifikasi final

| ID | Topik | Keputusan pengguna |
| --- | --- | --- |
| Q1 | Penggunaan contoh wording | Template pesan WhatsApp terpisah; ditulis bersama panduan berbagi di `PANDUAN-UNDANGAN.md` pada tahap implementasi. |
| Q2 | Sumber audio I Got Mine | Gunakan tautan MP3 GitHub yang diberikan pengguna dan tercantum pada REQ-03; simpan sebagai aset audio lokal situs. |
| Q3 | Foto halaman 7 | Gunakan `assets/gallery-6.webp` yang sudah tersedia. |

Tidak ada klarifikasi produk yang tertunda. Pengambilan MP3 dan pemeriksaan playback adalah langkah teknis implementasi, bukan alasan menunda finalisasi rencana. Waktu selesai acara serta verifikasi backend RSVP produksi tetap di luar perubahan ini.

## 11. Hasil implementasi

Seluruh revisi telah diterapkan. `PANDUAN-UNDANGAN.md` memuat petunjuk nama tamu, template WhatsApp terpisah, dan contoh pesan lengkap. Pengujian browser mencakup lebar 320–1440 px, personalisasi, musik, dua rekening, kalender, galeri, keyboard, reduced motion, serta validasi RSVP lokal. Foto acara dan tata letak rekening diperiksa secara visual pada desktop/mobile; lapisan penggelap hero mobile juga diperbaiki agar label lokasi terbaca.

Lihat [catatan verifikasi 29 September 2026](AUDIT-QA.md#verifikasi-revisi--29-september-2026) untuk rincian hasil dan batas pengujian. Tidak ada deployment produksi atau pengiriman RSVP produksi pada pekerjaan ini.
