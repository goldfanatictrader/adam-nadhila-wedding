# CELEYO — brand & interface v1

Create. Invite. Celebrate. · 29 September 2026

Panduan ini menerapkan keputusan BD1–BD3 pada [spec](../../spec.md#16-addendum-brand-identity-uiux-dan-design-system). Platform mengikuti identitas baru; desain undangan klien tetap mengikuti template masing-masing. Bahasa produk adalah Indonesia.

## Identitas dan sumber

Simbol kelopak/daun terbuka dengan bintang empat ujung direkonstruksi secara manual dari board R1 pengguna. Petal kiri memakai terracotta/peach; petal kanan sand/forest; celah memberi ruang terang. Wordmark CELEYO dan tagline berupa path dari Cormorant Garamond berlisensi SIL Open Font License. Font wordmark berbeda dari font judul UI.

Rekonstruksi adalah interpretasi vektor dari gambar, bukan file master asli atau tracing dengan jaminan geometri identik. Lima attachment asli disebutkan pada spec §16.1. Saat implementasi, file attachment lengkap sudah tidak tersedia di direktori environment; dua crop hasil perencanaan masih tersedia dan disimpan di [references](references/). R1 menjadi acuan bentuk yang terlihat pada percakapan; crop R2 menjadi acuan sistem visual. Nilai HEX adalah baseline digital v1, bukan klaim ekstraksi kode asli.

| Referensi tersimpan | Isi |
| --- | --- |
| [R1 palette crop](references/r1-palette-crop.png) | Palet dari board simbol pengguna |
| [R2 system crop](references/r2-system-crop.png) | Warna, tipografi, dan varian identitas pengguna |

## Master, ukuran, dan pemakaian

Seluruh master berada di [public/brand](../../public/brand). Komponen Astro dan React membaca file yang sama.

| Asset | Pemakaian |
| --- | --- |
| `symbol.svg` | Simbol tunggal, minimum 24 px; dekorasi yang mengulang nama memakai alt kosong |
| `logo-compact.svg` | Lockup tanpa tagline; minimum 132 px, header mobile dan footer undangan |
| `logo-horizontal.svg` | Lockup dengan tagline; disarankan ≥280 px agar tagline terbaca |
| `logo-stacked.svg` | Susunan bertumpuk; disarankan ≥240 px |
| Akhiran `-mono` | Forest solid pada bidang terang |
| Akhiran `-inverse` | Ivory solid pada bidang forest/gelap |
| `app-icon-ivory/terracotta/forest.svg` | Bingkai icon; bukan janji aplikasi native/PWA |
| `icon-32/180/192/512.png` | Export raster untuk favicon/apple icon/branding |
| `logo-email.png` | Lockup 3× untuk email, ditampilkan sekitar 210 px |
| `social-card.png` / `.svg` | Artwork statis 1200×630, tanpa data tamu |
| `/favicon.svg` / `/favicon.ico` | Simbol dengan bintang yang disederhanakan untuk ukuran kecil |

Sisakan clear space minimum 25% lebar simbol di setiap sisi lockup. Jangan meregangkan, memutar, mengubah posisi bintang, mengganti wordmark dengan teks sistem, atau menambahkan emboss/drop shadow pada master. Gunakan versi inverse pada bidang gelap; pada foto ramai, beri bidang solid yang melindungi kontras. Jangan menaruh logo warna pada terracotta tanpa panel ivory. Jangan gunakan huruf C lama sebagai pengganti.

Logo bertaut memiliki nama aksesibel **CELEYO — beranda**. Pada undangan, nama tautan menjelaskan “Dibuat dengan CELEYO — beranda”. Di layar kecil tanpa ruang tagline, gunakan compact. SVG berisi path dan transform dengan viewBox; tidak ada script, foreignObject, embedded photo, atau dependensi font eksternal.

Regenerasi logo dan export statis:

```sh
npm run brand:build
```

Sumber yang dapat disunting adalah `scripts/build-brand-assets.mjs`. Generator memakai font lokal, fontkitten, dan sharp; tidak memerlukan API atau jaringan. Export PNG ini merupakan aset platform, bukan fitur download kartu undangan.

## Warna

Primitif: forest `#142C22`, terracotta `#BC5538`, ivory `#FAF1E6`, sand `#E7CEB7`, sage `#818361`. Peach logo `#DFA88D` adalah aksen kelopak, bukan warna teks UI.

Sumber token: [tokens.css](../../src/styles/tokens.css). Nilai semantik dipakai di seluruh platform.

| Peran | Token CSS | Nilai / pasangan |
| --- | --- | --- |
| Background / surface | `--paper` / `--white` | `#FAF1E6` / `#FFFBF6` |
| Surface sekunder | `--surface-subtle` | `#F1E4D5` |
| Teks utama / sekunder | `--ink` / `--muted` | `#142C22` / `#615D50` |
| Primary / teks tombol | `--brand` / `--on-brand` | `#BC5538` / `#FFFFFF` |
| Hover / pressed | `--brand-dark` / `--brand-pressed` | `#A64730` / `#863924` |
| Selected | `--selected` | `#F5E2D5`, teks brand-dark |
| Border interaktif / dekoratif | `--control-border` / `--line` | `#867B69` / `#DFD2C2` |
| Disabled | `--disabled-surface` / `--disabled-text` | `#E9DFD2` / `#6A6258` |
| Success | `--success` / `--success-surface` | `#31533B` / `#E8EFDF` |
| Warning | `--warning` / `--warning-surface` | `#795019` / `#FFF0D4` |
| Danger | `--red` / `--danger-surface` | `#A63529` / `#FCE8E1` |
| Info | `--info` / `--info-surface` | `#325562` / `#E8F0EE` |
| Focus | `--focus` | Forest, outline 2 px dengan offset 4 px; inverse pada area gelap |

Rasio solid sRGB: forest/ivory **13,30:1**, muted/ivory **5,89:1**, putih/terracotta **4,67:1**, putih/hover **5,89:1**, border kontrol/surface **4,04:1**. Ivory/terracotta hanya sekitar 4,18:1, sehingga teks CTA kecil harus putih. Sage/sand bukan warna teks kecil. Label, ikon, dan bentuk tetap menjelaskan status tanpa bergantung pada warna saja. Border dekoratif tidak dipakai sebagai satu-satunya batas input.

## Tipografi, layout, dan ikon

- **Playfair Display**, roman/italic 400–600, untuk headline, h1/h2, dan judul emosional.
- **Inter**, 400–700, untuk body, navigasi, input, tabel, tombol, dan angka. Semua font platform dimuat lokal dengan `font-display: swap`; subset Latin mencakup bahasa Indonesia. Emoji memakai fallback sistem.
- Display 36–64 px; h1 aplikasi 28–36 px; h2 aplikasi 24–30 px; h3 18–22 px; body/input 16 px; data sekunder 14 px; caption 12–14 px. Body line-height 1,6. Harga/statistik memakai tabular numerals.
- Spacing: 4/8/12/16/24/32/48/64/96 px. Radius kontrol 11 px, card sekitar 18 px, pill hanya untuk chip/status. Shadow ringan pada card; elevasi lebih nyata pada modal.
- Marketing max 1200 px; gutter 16–20 px mobile, 24–32 px desktop. Sidebar sekitar 240 px; pada ≤960 px gunakan navigasi dialog. Grid beradaptasi di 640/960/1200 px; angka breakpoint melayani isi, bukan perangkat tertentu.
- Lucide digunakan untuk ikon interaktif. Aksi utama tetap berlabel; icon-only wajib memiliki nama aksesibel. Target sentuh minimum 44 px. Ilustrasi dekoratif bukan kontrol.
- Animasi singkat 160 ms; `prefers-reduced-motion` menonaktifkan transisi/animasi, termasuk skeleton dan progress upload. Nama panjang dan emoji harus membungkus, bukan memperlebar halaman.

Font undangan **Cormorant Garamond + DM Sans** dan `/fonts/fonts.css` tetap dipertahankan. Platform memuat `/fonts/platform/fonts.css` secara terpisah; iframe preview memuat stylesheet undangan sendiri.

## Komponen dan perilaku

Halaman **`/dev/design-system`** menampilkan varian dan state dengan data contoh. Hanya `APP_ENV=local` yang merendernya; staging/production mengembalikan 404. Tidak ada menu panduan pada produk produksi.

| Komponen/pola | Aturan |
| --- | --- |
| Button / link button / IconButton | Primary untuk aksi utama, secondary untuk alternatif, quiet untuk aksi ringan; destructive memakai danger. Loading menonaktifkan klik dan memberi label. Focus terlihat, disabled tetap terbaca. |
| TextField / Textarea / Select | Label persisten, input mobile 16 px, `aria-describedby` untuk bantuan/error terkait. Native input validation dipertahankan. |
| Checkbox / Radio / Switch | Kontrol native dengan label sentuh; state terlihat dan dapat digunakan dengan keyboard. |
| Tabs / mode selector | Kelompok tombol dengan `aria-pressed`, label dan indikator pilihan; tidak berpura-pura menjadi tab ARIA tanpa keyboard contract. |
| Badge / alert / toast | Teks menjelaskan status. Error memakai role alert; feedback memakai role status. Toast memiliki tombol tutup terpisah. |
| Card / StatCard / UsageMeter | Data operasional berasal dari API. Angka pada panduan diberi label contoh. Meter menampilkan pemakaian dan batas. |
| Modal / navigasi mobile | Nama dialog, focus trap, Escape menutup, fokus kembali ke pemicu. Background workspace dibuat inert bila berada di luar dialog. |
| DataTable / Pagination | Tabel boleh scroll horizontal dalam region bernama; halaman tidak overflow. Tombol halaman sebelumnya/berikutnya memiliki disabled state. |
| EmptyState / Skeleton | Jelaskan langkah berikutnya; status loading diumumkan tanpa statistik palsu. |
| UploadZone / MediaCard | Input file tetap dapat difokuskan lewat keyboard, indikator indeterminate selama upload, error jelas, alt/focal point tetap tersedia. Tidak mengarang persentase progres. |
| TemplateCard / Stepper | Thumbnail dari renderer demo aktual; alur pilih → susun → aktivasi/publish. Harga dan kategori mengikuti produk aktual. |
| InvoiceSummary / GuestSharePanel | Nominal, masa aktif, status, salin link dan wa.me dibedakan. Membuka WhatsApp tidak berarti mengirim atau mengonfirmasi pembayaran. |
| ComposeProposal / Diff | Proposal ditinjau dan diterapkan eksplisit; gagal/quota habis tetap mengizinkan editor manual. |

Pada editor, **Isi / Desain / Preview** adalah mode lokal; Media dan Compose tetap bagian studio. Draf belum tersimpan ditandai. Preview menampilkan **draf tersimpan**, bukan perubahan form yang belum disimpan. Simpan, preview, dan publish adalah tindakan terpisah. Navigasi meninggalkan draf meminta konfirmasi; berpindah mode/tab tidak menghapus isian. Sticky save bar memperhitungkan safe area mobile.

Email transaksi mendapat header logo PNG, warna brand, judul serif fallback, dan versi text lengkap. Tidak ada font eksternal atau tracking pixel. Isi user di-escape; hanya URL origin aplikasi yang dijadikan hyperlink. Template ini mengikuti [binding email Cloudflare](https://developers.cloudflare.com/email-service/get-started/send-emails/). Deliverability dan rendering klien email nyata belum diuji.

## Aset foto, font, dan lisensi

Tidak ada foto pilot yang digunakan untuk pemasaran. Foto pada mockup pengguna tidak didistribusikan sebagai stok. Image generation tidak tersedia pada sesi implementasi, sehingga memakai foto stok berlisensi yang disimpan lokal; tidak ada hotlink runtime.

| Berkas lokal | Sumber / lisensi |
| --- | --- |
| `celebration-640.webp`, `celebration-1100.webp` | Alexander Mass, [Wedding table setting with floral arrangements](https://unsplash.com/photos/wedding-table-setting-with-floral-arrangements-mE55CKaJAUo), [Unsplash License](https://unsplash.com/license), diakses 29 September 2026 |
| `coastal-flowers-640.webp`, `coastal-flowers-1100.webp` | Alexander Mass, [A beach wedding setup with an umbrella, table and flowers](https://unsplash.com/photos/a-beach-wedding-setup-with-an-umbrella-table-and-flowers-e1HAnOK0K9k), Unsplash License, diakses 29 September 2026 |
| `template-previews/*.webp` | Screenshot lokal gate demo Minimal Ivory/Botanical Bloom/Editorial Journey, memakai pasangan fiktif Aruna & Bima |
| `fonts/platform/inter-roman.woff2` | Google Fonts Inter Latin variable, [SIL OFL lokal](../../public/fonts/platform/inter-OFL.txt) |
| `fonts/platform/playfair-display-{roman,italic}.woff2` | Google Fonts Playfair Display Latin variable, [SIL OFL lokal](../../public/fonts/platform/playfairdisplay-OFL.txt) |
| Wordmark outline | Cormorant Garamond lokal, [SIL OFL](../../public/fonts/cormorantgaramond-OFL.txt) |

Font platform total sekitar **123 KiB**, satu font Inter dipreload. Hero menyediakan srcset 640/1100; katalog, foto sekunder dan preview memakai lazy loading bila sesuai. SVG menyimpan vector paths dan export raster memakai dimensi eksplisit.

## Contoh penerapan

[Landing desktop](examples/landing-desktop.webp) dan [landing mobile](examples/landing-mobile.webp) memperlihatkan bagian atas halaman yang diterapkan, dengan data demo fiktif. Untuk state interaktif dan komponen lengkap, buka `/dev/design-system` pada environment lokal. Screenshot dashboard/pilot disimpan lokal dan tidak menjadi materi pemasaran generik.

## Batas desain dan review

Desain mengambil simbol/warna/hierarki dari R1–R5, dengan susunan web yang menyesuaikan isi CELEYO. Foto, proporsi layar, teks, harga, dan template berbeda dari mockup agar menggambarkan fitur nyata. Tidak menampilkan aplikasi native, non-wedding, kartu/PNG, statistik pelanggan atau testimoni fiktif sebagai fungsi/fakta produk.

Wedding.astro hanya mengubah markup footer branding; wedding.css hanya menambahkan aturan `.celeyo-brand-footer`. Ditemukan bahwa fallback lama pada `/i/[slug]` ikut memuat CSS platform ke undangan publik. Fallback kini dirender melalui rute terpisah, sementara efek visual lama pada halaman publik dibekukan dalam `invitation-compat.css` (hanya selector yang cocok dengan DOM undangan). Ini menjaga tampilan baseline—termasuk override Georgia/burgundy yang sebelumnya sudah terlihat—tanpa bergantung pada CSS platform baru. Demo dan preview tetap memakai stylesheet aslinya, tanpa compatibility sheet tersebut. Font, palet, musik, RSVP, isi, foto dan konfigurasi pilot tidak dimigrasi. Starter tetap menampilkan branding; Premium/Signature mengikuti hide branding yang sudah ditegakkan server.

Hasil verifikasi dan batas produksi dicatat di [IMPLEMENTATION.md](../IMPLEMENTATION.md). Panduan ini tidak menyatakan domain, Cloudflare production, email live atau pembayaran nyata telah diluncurkan.

### Hasil perbandingan undangan

Screenshot sebelum perubahan disimpan lokal sebelum migrasi. Gate dan viewport awal sesudah dibuka pada tiga demo + pilot, masing-masing lebar 390/1440 dan tinggi 900 px, cocok **16/16 dengan nol piksel berbeda** setelah pemisahan CSS fallback.

Pembandingan halaman penuh memutar ulang sumber renderer/stylesheet yang disimpan sebelum perubahan dengan data lokal yang sama, lalu membandingkannya dengan versi baru. Area dipotong tepat sebelum footer; tidak ada masking konten. Tinggi semua bagian sebelum footer identik. Lima pasangan cocok byte-for-byte; tiga pasangan memiliki perbedaan maksimum satu nilai kanal warna (1/255) pada bayangan komposit. Dengan toleransi pembulatan tersebut, **8/8 halaman penuh cocok**, termasuk pilot yang cocok persis pada kedua ukuran. [Hasil JSON](invitation-regression.json) menyimpan jumlah perbedaan mentah dan maksimum kanal, bukan hanya status lulus. Screenshot yang memuat foto pilot tetap lokal di `/tmp/celeyo-brand-review`, tidak ditambahkan ke repositori.
