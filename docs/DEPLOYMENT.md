# Deployment CELEYO

Aplikasi belum diterbitkan ke akun Cloudflare. Semua perubahan di workspace dapat diperiksa sebelum konfigurasi produksi. Pendaftaran publik bergantung pada domain pengirim yang telah di-onboard ke Cloudflare Email Service; aktivasi paket tetap membutuhkan pemeriksaan operator.

## 1. Sumber daya terpisah

Siapkan D1 dan bucket R2 privat khusus `celeyo-production`, dan sumber daya lain khusus staging. Jangan menggunakan database/bucket produksi pada lokal atau PR. CLI resmi dapat dipakai untuk membuat sumber daya satu kali:

```sh
npx wrangler d1 create celeyo-production
npx wrangler r2 bucket create celeyo-production
```

Catat ID database untuk variable GitHub. Aktifkan Workers Paid, verifikasi pengelolaan DNS `celeyo.com`, onboard domain pengirim ke **Email Sending** (bukan hanya Email Routing), dan buat widget Turnstile untuk hostname yang sesuai. Verifikasi deliverability dan ketersediaan Workers AI pada staging sebelum membuka signup publik. Token CI memerlukan izin Workers deploy/secrets, D1 edit, R2 object edit untuk import terpisah, serta izin domain/route sesuai konfigurasi account. Jangan memberikan token kepada browser.

Referensi implementasi: [adapter Astro Cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/), [Cloudflare Email Sending](https://developers.cloudflare.com/email-service/get-started/send-emails/), [Better Auth](https://better-auth.com/docs/installation).

## 2. GitHub environment `production`

Secret:

| Nama | Isi |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token deploy Cloudflare. |
| `CLOUDFLARE_ACCOUNT_ID` | Account yang menampung resource CELEYO. |
| `CELEYO_WORKER_SECRETS` | JSON berisi `BETTER_AUTH_SECRET`, `GUEST_ENCRYPTION_KEY`, `RATE_LIMIT_SECRET`, `TURNSTILE_SECRET_KEY`. |
| `CELEYO_BACKUP_KEY` | Kunci AES 32-byte hex yang terpisah untuk backup CI. |

Buat tiga secret aplikasi pertama dengan `openssl rand -hex 32`; key guest wajib hex sepanjang 64 karakter. Simpan secara permanen dan cadangkan di penyimpanan privat operator. Mengganti guest key tanpa migrasi ciphertext merusak fitur salin ulang kode. Secret Turnstile berasal dari widget Cloudflare. JSON tidak boleh ditempel ke issue, PR, log, atau file tracked.

Variable:

- `CLOUDFLARE_D1_DATABASE_ID`: ID database produksi nyata.
- `CLOUDFLARE_R2_BUCKET`: nama bucket privat produksi.
- `PUBLIC_TURNSTILE_SITE_KEY`: site key widget.
- `EMAIL_FROM`: identitas pengirim terverifikasi, misalnya `CELEYO <hello@celeyo.com>` setelah onboarding.
- `AI_ENABLED`: `false` sampai uji model live lulus; kemudian `true`.
- `AI_DAILY_BUDGET_MICRO_USD`: batas estimasi biaya harian, integer micro-USD; default 100000 (US$0,10). Ini rem aplikasi, bukan jaminan tagihan account.
- `CELEYO_DEPLOY_ENABLED`: set `true` setelah sumber daya dan secret lengkap.

Workflow memeriksa hasil CI dari push `main`, checkout commit yang sama, membangun konfigurasi produksi, mengekspor dan mengenkripsi backup D1, menerapkan migrasi, deploy Worker/domain, memasang secret, lalu memeriksa health endpoint. Deploy diserialisasi. PR hanya menjalankan checks dengan resource lokal, tanpa secret produksi. Backup terenkripsi disimpan sebagai artifact privat GitHub 30 hari; simpan salinan operator jika perlu lebih lama. Tidak ada data rekening bisnis atau role superadmin yang di-seed oleh workflow.

Untuk staging, gunakan environment/secret/resource terpisah, `CELEYO_ENV=staging`, origin staging, dan jalankan script yang sama. Jangan menyetel origin staging ke celeyo.com. Script menolak ID D1 placeholder serta secret yang belum lengkap.

## 3. Operasi pertama

1. Daftarkan dan verifikasi akun operator melalui email aplikasi. Jalankan `npm run bootstrap:admin -- --email=<operator> --remote --config=wrangler.deploy.json` dari lingkungan operator yang memiliki akses Cloudflare.
2. Aktifkan TOTP, simpan kode pemulihan, lalu verifikasi ulang pada `/superadmin`. Role provider tidak dapat dipilih saat signup.
3. Isi rekening bisnis, nomor WhatsApp billing, versi instruksi, kebijakan refund, dan periode retensi billing/audit. Rekening hadiah pilot tidak disalin ke konfigurasi billing. Sampai rekening lengkap dan periode retensi ditetapkan, checkout produksi menolak membuat invoice.
4. Verifikasi email/reset/password/MFA, invoice dan mutasi fiktif di staging. Jangan mengirim WhatsApp atau memindahkan uang melalui pengujian otomatis.
5. Verifikasi callback Cron 15-menit, retry outbox, pengingat expiry, reserve AI/storage, dan budget. AI/Email Sending belum dianggap tervalidasi hanya karena binding berhasil di-deploy.

## 4. Import pilot & pengalihan alamat lama

`npm run setup:local` sudah membuat pemetaan pilot di `scripts/pilot-data.json`. Untuk remote, buat akun klien pilot dan verifikasi emailnya, lalu jalankan:

```sh
node scripts/provision-pilot.mjs --owner-id=<id-akun-pilot> --config=wrangler.deploy.json
```

Import terpisah mengunggah aset ke prefix event baru, memberi grant Signature yang tercatat di audit tanpa pendapatan palsu, dan menyimpan **draf**. Klien memeriksa data, foto, kalender, musik dan publikasi sendiri. Import menolak menimpa slug pilot yang sudah ada. Bila proses terputus, periksa hasil parsial dan prefix yang baru dibuat sebelum retry; jangan menjalankan reset database.

Setelah `https://celeyo.com/i/adam-nadhila` sehat:

```sh
node scripts/pages-redirect.mjs
npx wrangler pages deploy dist-pages --project-name adam-nadhila-wedding
```

Ini tindakan penerbitan terpisah. Worker redirect mempertahankan query, memakai tujuan tetap, menolak POST dengan 410, dan mulai dengan 302. Set `REDIRECT_PERMANENT=true` pada Pages hanya setelah tautan personal berhasil diuji; berikutnya 301. Alias `www` dapat dikonfigurasi melalui redirect Cloudflare dengan path/query tetap utuh.

## 5. Backup, restore, dan rollback

Backup D1 otomatis sebelum deploy dienkripsi AES-GCM menggunakan `CELEYO_BACKUP_KEY`. Dekripsi hanya di lingkungan operator privat:

```sh
node scripts/backup-crypto.mjs open backup.sql.enc restore.local.sql
npx wrangler d1 execute DB --remote --config=wrangler.staging.json --file=restore.local.sql
```

Gunakan database staging **kosong** untuk latihan restore, jangan menimpa produksi sembarangan. Uji login, media refs, invoice paid dan jumlah grant setelah restore. Kunci guest/auth dan objek R2 tidak berada dalam export D1: cadangkan key secara privat dan salin bucket R2 ke bucket backup Cloudflare terpisah dengan policy retensi operator. Latihan restore harus menggabungkan ketiganya. Salinan R2 remote dan recovery account belum dijalankan di workspace ini.

Rollback kode melalui versi Workers sebelumnya setelah memeriksa kompatibilitas schema. Migrasi additive tidak otomatis dibalik. Purge mempunyai penanda permanen dan pemeriksaan invoice sebelum menghapus objek, sehingga renewal dan purge tidak boleh menang bersama. Pemulihan sebelum purge memakai backup; sistem tidak menjanjikan data yang sudah dihapus dapat dikembalikan tanpa backup.

Rotasi guest key memerlukan pembacaan dan enkripsi ulang ciphertext dengan key version baru secara terkontrol; jangan sekadar mengganti secret. Untuk kebocoran token tamu individual, gunakan rotasi/cabut kode dari dashboard yang langsung membatalkan sesi lama.
