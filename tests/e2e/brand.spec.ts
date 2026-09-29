import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';

const origin = 'http://localhost:4321';
const widths = [320, 390, 768, 1024, 1440];
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

test('brand assets and local typography render; mobile navigation and component dialogs are accessible', async ({
  page,
}) => {
  const externalAssets: string[] = [];
  page.on('request', (request) => {
    if (['image', 'font'].includes(request.resourceType()) && !request.url().startsWith(origin))
      externalAssets.push(request.url());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
    'Inter',
  );
  expect(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
    'Playfair Display',
  );
  expect(
    await page
      .locator('img[src="/brand/logo-compact.svg"]')
      .first()
      .evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Menu navigasi', { exact: true }).click();
  await expect(page.locator('.mobile-menu nav')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-menu nav')).toBeHidden();
  for (const path of ['/login', '/register', '/reset-password', '/dev/design-system']) {
    await page.goto(path);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await fits(page);
    }
  }
  await page.getByRole('button', { name: 'Buka contoh dialog' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tutup', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Tutup contoh', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Tutup', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Buka contoh dialog' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.skeleton')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  expect(externalAssets).toEqual([]);
});

test('mobile studio preserves unsaved edits, loads the isolated preview, and uploads with feedback', async ({
  page,
}) => {
  const session = page.context().request;
  // A fresh verified tenant owns the one-time trial quota. Reusing the pilot would
  // correctly leave media quota at zero after earlier trial runs.
  const email = `brand-${Date.now()}@celeyo.test`;
  const credentials = { email, password: 'Brand-test-password-2026!' };
  expect(
    (
      await session.post('/api/auth/sign-up/email', {
        headers: { Origin: origin },
        data: { ...credentials, name: 'Adam QA' },
      })
    ).status(),
  ).toBe(200);
  const query = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--command',
      `SELECT body FROM outbox WHERE recipient='${email}' AND subject='Verifikasi email CELEYO'`,
      '--json',
    ],
    { encoding: 'utf8' },
  );
  if (query.status) throw new Error('Local verification email query failed');
  const body = JSON.parse(query.stdout)[0].results[0].body;
  const verification = new URL(body.match(/https?:\/\/\S+/)[0]);
  expect([200, 302]).toContain(
    (await session.get(verification.pathname + verification.search, { maxRedirects: 0 })).status(),
  );
  expect(
    (
      await session.post('/api/auth/sign-in/email', {
        headers: { Origin: origin },
        data: credentials,
      })
    ).status(),
  ).toBe(200);
  const created = await session.post('/api/events', {
    headers: { Origin: origin },
    data: { title: 'Cerita QA 🤍', slug: 'brand-' + Date.now(), templateId: 'minimal-ivory' },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  let release: (() => void) | undefined;
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Halo, Adam.' })).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await fits(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Buka navigasi workspace' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Buka navigasi workspace' })).toBeFocused();
    await page.goto('/app/' + id);
    const name = page.getByLabel('Nama panggilan mempelai pria');
    await name.fill('Alexander 🤍');
    await expect(page.locator('.editor-savebar')).toContainText('Belum disimpan');
    await page.getByRole('button', { name: 'Desain', exact: true }).click();
    await expect(name).toBeHidden();
    await page.getByRole('button', { name: 'Isi', exact: true }).click();
    await expect(name).toHaveValue('Alexander 🤍');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Pratinjau undangan"]');
    await expect(frame.getByRole('button', { name: 'Buka Undangan', exact: true })).toBeVisible();
    expect(await frame.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
      /^"?DM Sans/,
    );
    await expect(page.locator('.preview-caption')).toContainText('draf tersimpan');
    await page.getByRole('button', { name: 'Isi', exact: true }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('link', { name: 'Semua undangan' }).click();
    await expect(name).toHaveValue('Alexander 🤍');
    expect(new URL(page.url()).pathname).toBe('/app/' + id);
    await page.getByRole('button', { name: 'Simpan perubahan draf' }).click();
    await expect(page.locator('.editor-savebar')).toContainText('Draf tersimpan');
    await expect(page.getByRole('status')).toContainText('tersimpan');
    const saved = await (await session.get('/api/events/' + id)).json();
    expect(saved.draft.groom).toBe('Alexander 🤍');
    await page.getByRole('button', { name: 'Foto & musik', exact: true }).click();
    const uploading = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/events/${id}/media`, async (route) => {
      if (route.request().method() === 'POST') await uploading;
      await route.continue();
    });
    const input = page.getByLabel('Tambah foto atau MP3', { exact: true });
    await input.focus();
    await expect(input).toBeFocused();
    await input.setInputFiles('public/brand/icon-180.png');
    await expect(page.getByRole('status').filter({ hasText: 'Mengunggah aset' })).toBeVisible();
    await expect(input).toBeDisabled();
    release?.();
    await expect(page.locator('.toast[role="status"]')).toContainText('Aset berhasil diunggah');
    await expect(page.locator('.upload-progress')).toBeHidden();
    await expect(page.locator('.media-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Hapus aset', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Hapus aset?' })).toBeVisible();
    await page.getByRole('button', { name: 'Batalkan', exact: true }).click();
    await expect(page.locator('.media-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Hapus aset', exact: true }).click();
    await page.getByRole('button', { name: 'Ya, lanjutkan', exact: true }).click();
    await expect(page.locator('.media-card')).toHaveCount(0);
    for (const label of [
      'Foto & musik',
      'Tamu & ucapan',
      'Compose',
      'Paket & pembayaran',
      'Pengaturan',
    ]) {
      await page.locator('.tabs').getByRole('button', { name: label, exact: true }).click();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await fits(page);
      }
    }
    await page.locator('.tabs').getByRole('button', { name: 'Editor', exact: true }).click();
    await page.getByLabel('Nama panggilan mempelai pria').fill('Perubahan yang dibatalkan');
    let navigationPrompts = 0;
    page.once('dialog', async (dialog) => {
      navigationPrompts++;
      await dialog.accept();
    });
    await page.getByRole('link', { name: 'Semua undangan' }).click();
    await page.waitForURL('**/app');
    expect(navigationPrompts).toBe(1);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Keamanan akun' })).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await fits(page);
    }
  } finally {
    release?.();
    await session.delete('/api/events/' + id, { headers: { Origin: origin } });
  }
});

test('public wedding templates load only their original font stylesheet and CELEYO footer', async ({
  page,
}) => {
  for (const id of ['minimal-ivory', 'botanical-bloom', 'editorial-journey']) {
    await page.goto('/demo/' + id);
    await page.getByRole('button', { name: 'Buka Undangan', exact: true }).click();
    await expect(page.locator('.celeyo-brand-footer img')).toHaveAttribute(
      'src',
      '/brand/logo-compact.svg',
    );
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
      /^"?DM Sans/,
    );
    expect(
      await page.evaluate(() =>
        [...document.styleSheets].some((sheet) => sheet.href?.includes('/platform')),
      ),
    ).toBe(false);
    expect(
      await page
        .locator('h1')
        .first()
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).not.toContain('Playfair');
  }
});
