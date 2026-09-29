# Status implementasi CELEYO

Diperbarui 29 September 2026. Implementasi awal tersedia dan diuji di workspace; belum ada deployment ke akun Cloudflare atau transaksi/pengiriman WhatsApp nyata. Keputusan produk tetap mengacu pada [spec.md](../spec.md).

## Cakupan yang sudah tersedia

- Landing CELEYO, tagline, katalog tiga template, demo dengan data fiktif, dan paket Starter Rp49.000, Premium Rp149.000, Signature Rp299.000 per acara.
- Astro + React pada runtime Workers, migrasi D1, R2 privat, akun email/password dengan verifikasi dan reset, workspace/event, satu editor Signature, serta superadmin dengan authenticator dan verifikasi ulang.
- Studio wedding: isi pasangan/acara/cerita, tema, modul opsional, urutan galeri, preview mobile/desktop, versi draf, undo, dan publikasi snapshot terpisah. Media JPEG/PNG/WebP dan MP3, validasi file/dimensi/kuota, alt text dan posisi fokus. Musik R2 serta pemutar YouTube terlihat dengan interaksi pengguna.
- Tamu: tambah/edit/impor CSV, nomor WhatsApp, grup dan batas rombongan, link wa.me, kode personal acak, rotasi/cabut, sesi tamu, RSVP dan satu ucapan yang dapat diperbarui. Moderasi tersembunyi tidak dibatalkan oleh edit tamu; ekspor CSV menetralkan formula.
- Billing transfer manual: snapshot harga/instruksi, invoice, tautan konfirmasi WhatsApp, klaim klien, pencocokan nominal dan referensi mutasi oleh operator, approval atomik, add-on, upgrade, perpanjangan, refund yang dicatat setelah transfer manual, serta grant pilot/kompensasi yang tidak menambah pendapatan.
- Superadmin: ringkasan, pembayaran, penangguhan akun/event, katalog, versi harga/kuota, rekening bisnis/nomor billing, retensi, audit dan AI kill switch. Jasa setup mempunyai tiket, izin klien terbatas waktu dan dua putaran revisi; tim tidak memublikasikan atas nama klien.
- Compose: integrasi Workers AI, proposal tervalidasi, diff/apply, pemeriksaan versi draf, kuota/budget, timeout dan idempotency. Editor tetap tersedia saat AI dinonaktifkan. Tidak ada alat untuk mengirim pesan, membayar, menerbitkan atau mengeksekusi kode melalui AI.
- Cron: expiry, pengingat email, retry outbox, pelepasan reservation macet, pembersihan media dan purge setelah tenggang dengan pemeriksaan invoice/tiket. Retensi billing ditetapkan operator sebelum checkout produksi dibuka.
- Pilot Adam & Nadhila diimpor ke D1/R2 lokal; aset pribadi tidak disalin ke demo publik. Versi statis tersimpan di `legacy/`. Import remote menyimpan draf dengan grant yang diaudit; pengalih Pages lama merupakan script terpisah yang belum diterbitkan.
- GitHub CI, deployment Workers, backup D1 terenkripsi sebelum migrasi, konfigurasi staging/production terpisah, bootstrap operator, serta petunjuk pemulihan dan setup pada [DEPLOYMENT.md](DEPLOYMENT.md).

## Brand, UI/UX dan design system

- Identitas baru CELEYO diterapkan ke landing/katalog, auth, shell klien dan superadmin, editor, Compose, tamu, media, billing dan akun. Logo kelopak/bintang direkonstruksi sebagai SVG bersama lockup, varian mono/inverse, favicon, app icon, email PNG dan artwork sosial.
- Palet ivory/forest/terracotta/sand/sage, Playfair Display + Inter lokal, token semantik dan komponen bersama didokumentasikan pada [GUIDELINES.md](brand/GUIDELINES.md). Foto pemasaran berlisensi disimpan lokal; demo tidak memakai foto pilot. Tersedia 17 SVG valid tanpa script/font eksternal serta export PNG/ICO.
- Navigasi mobile dapat dioperasikan lewat keyboard. Dialog mempunyai focus trap, Escape dan pemulihan fokus; konfirmasi penghapusan aset/rotasi/pencabutan kode menjelaskan dampaknya. Editor memisahkan Isi/Desain/Preview, mempertahankan draf antar-mode, menandai perubahan belum disimpan, dan meminta satu konfirmasi saat meninggalkan draf.
- Preview memakai draf tersimpan dan stylesheet undangan tersendiri; CSP mengizinkan iframe origin sendiri. Input upload dapat difokuskan, progres indeterminate diumumkan, dan kuota trial yang telah digunakan diberi penjelasan. Kontrak quota/tenant tetap ditegakkan server.
- Footer undangan memakai lockup baru sesuai hide branding. Kebocoran CSS platform melalui fallback `/i` dipisahkan; `invitation-compat.css` mempertahankan efek visual baseline halaman publik. Halaman tidak tersedia dirender melalui rute terpisah dengan status 404 dan gaya platform.
- Email transaksi mendapat template HTML brand dengan isi yang di-escape, URL origin aplikasi, PNG logo dan versi text; outbox/retry tidak berubah. Tidak ada email nyata dikirim selama pekerjaan ini.
- `/dev/design-system` hanya tersedia pada `APP_ENV=local`. Build dijalankan lokal dengan `APP_ENV=production` dan rute tersebut menghasilkan 404; ini bukan deployment ke produksi.
- Tidak ada migrasi tabel, perubahan konten pilot, Invitation Card, ekspor PNG klien atau layanan baru di luar infrastruktur yang disepakati.

## Verifikasi lokal

- `npm run verify`: typecheck tanpa error, pemeriksaan format, 23 tes unit/integrasi, dan build adapter Cloudflare lulus.
- Migrasi D1 lokal sampai `0004_manual_grants.sql` diterapkan; seed dapat diulang tanpa menimpa akun/event pilot.
- Tes mencakup isolasi tenant/editor/support, versi draf dan media asing, batas paket, kode lintas event dan pencabutan sesi, ucapan/moderasi, transaksi pembayaran dan referensi bank duplikat, upgrade/expiry, grant tanpa pendapatan, R2 privat/range, AI gagal/idempotent, purge versus renewal, serta enkripsi/dekripsi backup.
- Playwright pada Chromium memakai Workers/D1/R2 lokal: akses file privat, responsivitas 320–1440 px dan ketiga template, login/editor, undangan personal/RSVP/moderasi, verifikasi email dan TOTP. **8 dari 8 tes browser lulus** setelah pengujian ulang; tidak ada file privat yang dapat diambil lewat URL uji.
- `npm audit --audit-level=high`: 0 kerentanan pada seluruh dependency yang terpasang, termasuk dependency produksi. Pemeriksaan sintaks seluruh script operasional dan `git diff --check` lulus.
- Tes browser tambahan mencakup font/aset lokal, navigasi mobile, focus trap/return, reduced motion, draf lintas-mode, pembatalan/konfirmasi navigasi, iframe preview, unggah dan hapus R2 lokal. Overflow diperiksa pada 320/390/768/1024/1440 px untuk landing/auth, dashboard, studio/media/tamu/Compose/billing/pengaturan/akun serta enam panel superadmin.
- Gate/viewport tiga demo dan pilot cocok persis pada 16 screenshot sebelum/sesudah. Delapan pasangan halaman penuh mempertahankan posisi footer dan cocok dengan toleransi pembulatan bayangan 1/255; kedua ukuran pilot cocok persis. [Laporan visual mentah](brand/invitation-regression.json) mencatat selisih tanpa menyembunyikan konten. Font/style platform tidak ikut masuk ke undangan publik, demo atau preview.
- Peninjauan visual melalui Browser tab; tidak ada WhatsApp, email produksi, transfer bank atau inference berbayar dalam tes. Email lokal dibaca dari outbox; AI memakai binding tiruan.
- Secret, database lokal, kredensial seed, build, backup dan output browser diabaikan Git. Sumber/aset pilot dan arsip tidak dilayani sebagai file statis oleh preview aplikasi.

## Batas implementasi dan pekerjaan sebelum peluncuran

1. Konfigurasi Cloudflare/GitHub, domain/DNS/TLS, domain pengirim Email Sending, Turnstile, rekening bisnis dan WhatsApp operator belum dipasang. Signup/email dan checkout live belum dinyatakan siap produksi.
2. Binding Compose sudah diimplementasikan; kualitas brief bahasa Indonesia, latensi dan pemakaian token pada model Cloudflare nyata belum diuji. AI default mati sampai evaluasi staging lulus. Perkiraan biaya pada spec belum dibuktikan dengan beban produksi.
3. Uji backup lokal memverifikasi enkripsi dan pemulihan isi SQL. Latihan restore database lengkap, salinan R2 terpisah, pemulihan key/account dan rollback staging belum dijalankan. Backup otomatis saat ini mencakup D1 sebelum deploy; salinan R2 masih prosedur operator.
4. Ciphertext kode tamu memakai format versi `v1` dengan satu key aktif. Dashboard dapat merotasi token tamu, tetapi rotasi key enkripsi global memerlukan migrasi terkontrol; belum ada key ring/migrator otomatis.
5. Editor awal memakai susunan modul per template, dengan toggle modul opsional dan urutan galeri/cerita. Pengaturan bebas urutan seluruh modul dalam batas template belum tersedia. Upload memvalidasi file/dimensi, tetapi belum membuat varian gambar terkompresi otomatis atau thumbnail server.
6. Template memakai renderer versi pertama. Pembaruan versi renderer dan migrasi lintas versi mendatang tetap memerlukan implementasi serta review kode; dashboard hanya mengatur metadata/availability.
7. Tes lokal belum menggantikan load test concurrency D1/R2 yang sesungguhnya, pemeriksaan deliverability, aksesibilitas manual dengan pembaca layar, pengujian Safari/perangkat nyata, rekonsiliasi operasional, alert account, serta pengukuran biaya/latensi pada staging.

Belum ada deployment, pembelian layanan, perubahan DNS, transfer bank atau pengiriman WhatsApp produksi.
