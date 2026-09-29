# CELEYO

**Create. Invite. Celebrate.** Platform undangan wedding dengan Astro, React, Cloudflare Workers, D1, R2, Better Auth, dan Workers AI. Domain produksi yang direncanakan: **celeyo.com**.

## Menjalankan secara lokal

Memerlukan Node.js 24. Dev Container memasang versi ini pada rebuild berikutnya.

```sh
npm ci
npm run setup:local
npm run dev
```

Buka `http://localhost:4321`. Setup membuat secret acak dalam `.dev.vars`, database/R2 lokal, dan pilot `/i/adam-nadhila`. Kredensial akun pilot lokal ada di **`seed.local.json`** yang diabaikan Git. Tidak ada password bawaan produksi. Mengulang seed tidak menimpa akun, konten, atau token tamu yang telah dibuat. Musik dan foto pilot diimpor dari `assets/`, tidak dipublikasikan sebagai aset statis platform.

Untuk superadmin lokal, promosikan akun yang telah diverifikasi secara eksplisit:

```sh
npm run bootstrap:admin -- --email=client@celeyo.test
```

Masuk, aktifkan authenticator pada `/account`, simpan kode pemulihan, lalu buka `/superadmin` dan verifikasi password/TOTP. Local seed tidak otomatis memberikan role operator.

Email lokal masuk ke tabel `outbox`; tidak dikirim ke penerima nyata. Compose lokal dinonaktifkan dan menampilkan pesan yang memungkinkan klien tetap memakai editor. Tes AI menggunakan binding tiruan; tidak ada panggilan model berbayar.

Untuk preview dengan hostname workspace, jalankan dengan `CELEYO_PREVIEW_HOST=<hostname>` dan atur `PUBLIC_SITE_URL` serta `BETTER_AUTH_URL` dalam `.dev.vars` ke origin HTTPS preview. Origin localhost hanya diizinkan ketika `APP_ENV=local`.

## Pemeriksaan

```sh
npm run verify
npx playwright install --with-deps chromium
npm run test:e2e
```

Tes unit/integrasi menjalankan migrasi SQL yang sama pada SQLite dengan adaptor D1, termasuk rollback batch. Tes browser memakai runtime Workers lokal yang sebenarnya. `npm run format` merapikan sumber. D1 migrations bersifat berurutan; jangan mengubah migrasi yang sudah diterapkan ke produksi.

## Struktur

- `src/pages` — landing, akun, dashboard, studio, template demo, undangan publik, dan API.
- `src/lib/server` — autentikasi, scope tenant/event, billing atomik, kode tamu, media, Compose, dan cron.
- `migrations` — skema Better Auth dan data platform.
- `scripts` — setup lokal, bootstrap operator, import pilot, deploy, backup terenkripsi, dan pengalih Pages lama.
- `legacy` — versi statis sebelumnya untuk pembandingan; tidak ikut deployment Workers.
- `spec.md` — keputusan produk dan kontrak fitur.

Petunjuk produksi, secret GitHub, pilot, restore, dan batas verifikasi ada di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Hasil implementasi dan pengujian dicatat di [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

## Brand dan UI

Identitas CELEYO, aturan logo, warna, font, sumber foto, dan perilaku komponen ada di [panduan brand](docs/brand/GUIDELINES.md). Jalankan `npm run brand:build` untuk regenerasi SVG/favicon/artwork dari sumber lokal. `/dev/design-system` tersedia hanya dengan `APP_ENV=local` untuk review komponen; environment lain mengembalikan 404.

Platform memakai Playfair Display/Inter lokal. Font, warna, dan renderer undangan tetap terpisah; perubahan brand pada undangan dibatasi ke footer sesuai entitlement. Di editor, mode Isi/Desain/Preview mempertahankan input dan preview menampilkan draf terakhir yang disimpan.
