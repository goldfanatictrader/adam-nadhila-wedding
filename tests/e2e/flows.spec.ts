import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
const credentials = JSON.parse(readFileSync('seed.local.json', 'utf8'));
const origin = 'http://localhost:4321';
test('private workspace files are never served by the preview', async ({ request }) => {
  for (const path of [
    '/seed.local.json',
    '/.dev.vars',
    '/scripts/pilot-data.json',
    '/legacy/index.html',
    '/assets/hero.webp',
  ]) {
    const r = await request.get(path);
    expect([403, 404]).toContain(r.status());
  }
});
async function login(request: APIRequestContext) {
  const r = await request.post('/api/auth/sign-in/email', {
    headers: { Origin: origin },
    data: credentials,
  });
  expect(r.status()).toBe(200);
  return request;
}
test('landing and all templates render on mobile without horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Kisah Anda. Undangan yang begitu personal.' }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  for (const template of ['minimal-ivory', 'botanical-bloom', 'editorial-journey']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/' + template);
    await page.getByRole('button', { name: 'Buka Undangan', exact: true }).click();
    await expect(page.locator('#mainContent')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#rsvpForm button[type=submit]')).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});
test('email/password dashboard creates and edits a private draft; unverified and foreign requests fail', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Masuk ke CELEYO' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Halo, Adam' })).toBeVisible();
  await page.getByRole('button', { name: 'Buat undangan', exact: true }).click();
  const slug = 'uji-' + Date.now();
  await page.getByLabel('Judul undangan').fill('Pernikahan Uji Browser');
  await page.getByLabel('Alamat undangan').fill(slug);
  await page.getByRole('button', { name: 'Buat undangan ↗', exact: true }).click();
  await page.waitForURL(/\/app\/[^/]+$/);
  const id = page.url().split('/').at(-1)!;
  await page.getByLabel('Nama panggilan mempelai pria').fill('Aruna');
  await page.getByLabel('Nama panggilan mempelai wanita').fill('Bima');
  await page.getByRole('button', { name: 'Simpan perubahan draf' }).click();
  await expect(page.getByRole('status')).toContainText('tersimpan');
  const session = page.context().request;
  expect((await session.get('/api/events/' + id)).status()).toBe(200);
  expect((await request.get('/api/events/' + id)).status()).toBe(401);
  expect((await request.get('/i/' + slug)).status()).toBe(404);
  const csrf = await session.post('/api/events/' + id + '/publish', {
    headers: { Origin: 'https://evil.test' },
    data: { version: 2 },
  });
  expect(csrf.status()).toBe(403);
  const pub = await session.post('/api/events/' + id + '/publish', {
    headers: { Origin: origin },
    data: { version: 2 },
  });
  expect(pub.status()).toBe(402);
  const ai = await session.post('/api/events/' + id + '/compose', {
    headers: { Origin: origin },
    data: { message: 'Tulis pembuka', version: 2, requestKey: crypto.randomUUID() },
  });
  expect(ai.status()).toBe(503);
  expect(
    (await session.delete('/api/events/' + id, { headers: { Origin: origin } })).status(),
  ).toBe(200);
});
test('personal link opens once per interaction, saves one editable wish, moderates and revokes', async ({
  page,
  request,
}) => {
  await login(request);
  const stamp = Date.now();
  const add = await request.post('/api/events/pilot-event/guests', {
    headers: { Origin: origin },
    data: {
      guests: [{ name: `Tamu QA ${stamp} 🤍`, phone: '', group: 'Uji otomatis', maxParty: 2 }],
    },
  });
  expect(add.status()).toBe(200);
  const list = await (await request.get('/api/events/pilot-event/guests?q=' + stamp)).json();
  const guest = list[0];
  expect(guest.opened_at).toBeNull();
  const personal = await (
    await request.get(`/api/events/pilot-event/guests/${guest.id}/link`)
  ).json();
  const path = new URL(personal.url);
  await page.goto(path.pathname + path.search);
  await expect(page.locator('#guestName')).toContainText('Tamu QA');
  const unopened = await (await request.get('/api/events/pilot-event/guests?q=' + stamp)).json();
  expect(unopened[0].opened_at).toBeNull();
  await page.getByRole('button', { name: 'Buka Undangan', exact: true }).click();
  await expect(page.locator('#attendance')).toBeEnabled();
  expect(page.url()).not.toContain('code=');
  await page.locator('#attendance').selectOption('yes');
  await page.locator('#guestCount').selectOption('2');
  await page.locator('#guestMessage').fill('Selamat dari pengujian browser 🤍');
  await page.getByRole('button', { name: 'Kirim Konfirmasi', exact: true }).click();
  await expect(page.locator('#formStatus')).toContainText('tersimpan');
  await expect(page.locator('#wishFeed')).toContainText('Selamat dari pengujian browser');
  await request.post(`/api/events/pilot-event/guests/${guest.id}/moderate`, {
    headers: { Origin: origin },
    data: { hidden: true },
  });
  await page.locator('#guestMessage').fill('Pesan diedit setelah moderasi');
  await page.getByRole('button', { name: 'Kirim Konfirmasi', exact: true }).click();
  await expect(page.locator('#formStatus')).toContainText('tersimpan');
  await expect(page.locator('#wishFeed')).not.toContainText('Pesan diedit setelah moderasi');
  await request.post(`/api/events/pilot-event/guests/${guest.id}/revoke`, {
    headers: { Origin: origin },
    data: {},
  });
  const response = await page.context().request.get('/api/invitations/adam-nadhila/response');
  expect(response.status()).toBe(403);
  const audio = await request.get('/api/media/pilot-paul-partohap-i-got-mine-mp3', {
    headers: { Range: 'bytes=0-99' },
  });
  expect(audio.status()).toBe(206);
  expect((await audio.body()).length).toBe(100);
});

test('verification email gates login and superadmin requires password plus TOTP', async ({
  playwright,
  browser,
}) => {
  const { spawnSync } = await import('node:child_process');
  const { createHmac } = await import('node:crypto');
  const db = (command: string) => {
    const r = spawnSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', command, '--json'],
      { encoding: 'utf8' },
    );
    if (r.status) throw new Error('Local test query failed');
    return JSON.parse(r.stdout)[0].results;
  };
  const ctx = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const email = `operator-${Date.now()}@celeyo.test`,
    password = 'Temporary-test-password-2026!';
  const signup = await ctx.post('/api/auth/sign-up/email', {
    data: { name: 'Operator QA', email, password },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user;
  const before = await ctx.post('/api/auth/sign-in/email', { data: { email, password } });
  expect(before.status()).toBe(403);
  const mail = db(
    `SELECT body FROM outbox WHERE recipient='${email}' AND subject='Verifikasi email CELEYO'`,
  )[0];
  expect(mail).toBeTruthy();
  const url = new URL(mail.body.match(/https?:\/\/\S+/)[0]);
  const verified = await ctx.get(url.pathname + url.search, { maxRedirects: 0 });
  expect([200, 302]).toContain(verified.status());
  expect((await ctx.post('/api/auth/sign-in/email', { data: { email, password } })).status()).toBe(
    200,
  );
  expect((await ctx.get('/api/admin')).status()).toBe(403);
  db(`INSERT INTO operators VALUES('${user.id}')`);
  expect((await ctx.get('/api/admin')).status()).toBe(403);
  const enable = await ctx.post('/api/auth/two-factor/enable', { data: { password } });
  expect(enable.status()).toBe(200);
  const uri = (await enable.json()).totpURI;
  const secret = new URL(uri).searchParams.get('secret')!;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.toUpperCase().replace(/=+$/, ''))
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', bytes).update(counter).digest();
  const offset = mac[19] & 15;
  const code = (
    (new DataView(mac.buffer, mac.byteOffset, mac.byteLength).getUint32(offset, false) &
      0x7fffffff) %
    1000000
  )
    .toString()
    .padStart(6, '0');
  const confirm = await ctx.post('/api/auth/two-factor/verify-totp', {
    data: { code, trustDevice: false },
  });
  expect(confirm.status()).toBe(200);
  expect((await ctx.get('/api/admin')).status()).toBe(403);
  const wrong = await ctx.post('/api/admin/elevate', {
    data: { password: 'wrong-password', code },
  });
  expect(wrong.status()).not.toBe(200);
  const elevate = await ctx.post('/api/admin/elevate', { data: { password, code } });
  expect(elevate.status()).toBe(200);
  expect((await ctx.get('/api/admin')).status()).toBe(200);
  const operator = await browser.newContext({ storageState: await ctx.storageState() });
  const panel = await operator.newPage();
  await panel.goto(origin + '/superadmin');
  await expect(panel.getByRole('heading', { name: 'Rekonsiliasi pembayaran' })).toBeVisible();
  for (const label of [
    'Pembayaran',
    'Klien & event',
    'Katalog & harga',
    'Rekening & operasional',
    'Jasa setup',
    'Audit',
  ]) {
    await panel.locator('.tabs').getByRole('button', { name: label, exact: true }).click();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await panel.setViewportSize({ width, height: 900 });
      expect(
        await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
  }
  await operator.close();
  await ctx.dispose();
});
