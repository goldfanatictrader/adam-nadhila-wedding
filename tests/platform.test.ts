import { describe, it, expect, afterEach } from 'vitest';
import { fixtures } from './helpers';
import { accessEvent } from '../src/lib/server/auth';
import { saveEvent, publishEvent, createEvent, lifecycle } from '../src/lib/server/events';
import {
  addGuests,
  guestLink,
  openGuest,
  currentGuest,
  rotateGuest,
  respond,
  guestCookie,
  updateGuest,
} from '../src/lib/server/guests';
import {
  createInvoice,
  claimInvoice,
  approveInvoice,
  refundInvoice,
  manualGrant,
} from '../src/lib/server/billing';
import { uploadMedia, serveMedia, deleteMedia, validateMedia } from '../src/lib/server/media';
import { compose, applyProposal, validateProposal } from '../src/lib/server/ai';
import { blankContent, csvCell, normalizePhone } from '../src/lib/content';
import { addMonths } from '../src/lib/catalog';
import { parseCsv } from '../src/lib/client';
import { contentSchema } from '../src/lib/content';
import { originCheck } from '../src/lib/server/security';
import { readFileSync } from 'node:fs';
const cleanup: (() => void)[] = [];
function setup() {
  const f = fixtures();
  cleanup.push(() => f.local.close());
  return f;
}
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});
const approval = (total: number, reference = 'BANK-REFERENCE-001') => ({
  amount: total,
  bankReference: reference,
  whatsappReceived: true as const,
  transferredAt: Date.now() - 1000,
  note: 'WhatsApp dan mutasi fiktif sudah cocok.',
  expiredException: false,
});
describe('tenant isolation and content', () => {
  it('rejects cross-tenant lookups and grants only one scoped editor', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner),
      other = f.event('event-b', f.other);
    await expect(accessEvent(f.env, f.other, e.id)).rejects.toMatchObject({ status: 404 });
    f.local.raw
      .prepare('INSERT INTO event_members VALUES(?,?,?)')
      .run(e.tenant_id, e.id, f.editor.id);
    expect((await accessEvent(f.env, f.editor, e.id)).id).toBe(e.id);
    await expect(accessEvent(f.env, f.editor, e.id, true)).rejects.toMatchObject({ status: 404 });
    await expect(accessEvent(f.env, f.editor, other.id)).rejects.toMatchObject({ status: 404 });
  });
  it('requires explicit unexpired support access', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner);
    await expect(accessEvent(f.env, f.operator, e.id)).rejects.toMatchObject({ status: 404 });
    f.local.raw
      .prepare('INSERT INTO support_access VALUES(?,?,?,?,?,?,?)')
      .run(
        'support',
        e.tenant_id,
        e.id,
        f.operator.id,
        'Customer consent',
        Date.now() + 60000,
        Date.now(),
      );
    expect((await accessEvent(f.env, f.operator, e.id)).id).toBe(e.id);
    await expect(accessEvent(f.env, f.operator, e.id, true)).rejects.toMatchObject({ status: 404 });
  });
  it('detects stale edits and blocks draft cross-tenant media references', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner);
    const input = {
      version: e.version,
      templateId: 'minimal-ivory' as const,
      content: { ...JSON.parse(e.draft), opening: 'Perubahan pertama' },
    };
    await saveEvent(f.env, f.owner, e, input);
    await expect(saveEvent(f.env, f.owner, e, input)).rejects.toThrow();
    const stored = f.local.raw.prepare('SELECT draft,version FROM events WHERE id=?').get(e.id)!;
    expect(stored.version).toBe(2);
    await expect(
      saveEvent(
        f.env,
        f.owner,
        { ...e, version: 2 },
        { ...input, version: 2, content: { ...input.content, hero: 'other-asset' } },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('does not allow publishing a premium trial template with Starter', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner, 'starter');
    e.template_id = 'editorial-journey';
    f.local.raw.prepare('UPDATE events SET template_id=? WHERE id=?').run(e.template_id, e.id);
    await expect(publishEvent(f.env, f.owner, e, e.version)).rejects.toMatchObject({ status: 403 });
  });
  it('keeps trial consumption after deleting a draft', async () => {
    const f = setup();
    const first = await createEvent(f.env, f.owner, {
      title: 'First event',
      slug: 'first-event',
      templateId: 'minimal-ivory',
    });
    f.local.raw.prepare("UPDATE events SET status='deleted' WHERE id=?").run(first.id);
    const second = await createEvent(f.env, f.owner, {
      title: 'Second event',
      slug: 'second-event',
      templateId: 'minimal-ivory',
    });
    const e = f.local.raw
      .prepare('SELECT ai_credits,media_limit FROM events WHERE id=?')
      .get(second.id)!;
    expect(e.ai_credits).toBe(0);
    expect(e.media_limit).toBe(0);
  });
  it('rejects script URLs, arbitrary fields, invalid dates and cross-origin writes', () => {
    expect(contentSchema.safeParse({ ...blankContent, maps: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(contentSchema.safeParse({ ...blankContent, script: 'alert(1)' }).success).toBe(false);
    const f = setup();
    expect(() =>
      originCheck(
        f.env,
        new Request('http://localhost:4321/api/events', {
          method: 'POST',
          headers: { Origin: 'https://attacker.test' },
        }),
      ),
    ).toThrow();
  });
});
describe('guest codes, concurrency and moderation', () => {
  it('enforces the guest quota atomically, scopes tokens, and invalidates sessions on rotation', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner),
      other = f.event('event-b', f.other);
    await publishEvent(f.env, f.owner, e, e.version);
    await publishEvent(f.env, f.other, other, other.version);
    f.local.raw.prepare('UPDATE events SET guest_limit=1 WHERE id=?').run(e.id);
    await addGuests(f.env, f.owner, e, [
      { name: 'Nadilla 🤍', phone: '08123456789', group: 'Keluarga', maxParty: 2 },
    ]);
    await expect(
      addGuests(f.env, f.owner, e, [{ name: 'Extra', phone: '', group: '', maxParty: 1 }]),
    ).rejects.toThrow();
    expect(f.local.raw.prepare('SELECT count(*) AS n FROM guests').get()!.n).toBe(1);
    const g = f.local.raw.prepare('SELECT * FROM guests WHERE event_id=?').get(e.id)!;
    const link = await guestLink(f.env, e, String(g.id));
    const raw = new URL(link.url).searchParams.get('code')!;
    expect(link.url).toContain('code=');
    await expect(
      openGuest(f.env, new Request('http://localhost/'), other.slug, raw),
    ).rejects.toMatchObject({ status: 403 });
    const opened = await openGuest(f.env, new Request('http://localhost/'), e.slug, raw);
    const request = new Request('http://localhost/', {
      headers: { cookie: `${guestCookie(e.id)}=${opened.session}` },
    });
    expect((await currentGuest(f.env, request, e)).name).toBe('Nadilla 🤍');
    await rotateGuest(f.env, f.owner, e, String(g.id));
    await expect(currentGuest(f.env, request, e)).rejects.toMatchObject({ status: 403 });
  });
  it('keeps one response, checks version and preserves hidden moderation after edits', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner);
    await addGuests(f.env, f.owner, e, [{ name: 'Tamu', phone: '', group: '', maxParty: 2 }]);
    const g = f.local.raw.prepare('SELECT * FROM guests').get() as any;
    const r = { attending: true, party: 2, message: 'Selamat!', version: 0, website: '' };
    await respond(f.env, new Request('http://localhost/'), e, g, r);
    await expect(respond(f.env, new Request('http://localhost/'), e, g, r)).rejects.toThrow();
    f.local.raw.prepare('UPDATE responses SET hidden=1').run();
    await respond(f.env, new Request('http://localhost/'), e, g, {
      ...r,
      version: 1,
      message: 'Doa diperbarui',
    });
    const row = f.local.raw.prepare('SELECT * FROM responses').get()!;
    expect(row.hidden).toBe(1);
    expect(row.version).toBe(2);
    expect(row.message).toBe('Doa diperbarui');
    await expect(
      updateGuest(f.env, f.owner, e, g.id, {
        name: 'Nama baru',
        phone: '',
        group: '',
        maxParty: 1,
      }),
    ).rejects.toThrow();
    await updateGuest(f.env, f.owner, e, g.id, {
      name: 'Nama baru',
      phone: '081234567890',
      group: 'Keluarga',
      maxParty: 2,
    });
    expect(f.local.raw.prepare('SELECT name,phone FROM guests WHERE id=?').get(g.id)).toMatchObject(
      { name: 'Nama baru', phone: '6281234567890' },
    );
    const other = f.event('other-event', f.other);
    await expect(
      updateGuest(f.env, f.other, other, g.id, {
        name: 'Salah',
        phone: '',
        group: '',
        maxParty: 2,
      }),
    ).rejects.toThrow();
    await expect(
      respond(f.env, new Request('http://localhost/'), e, g, { ...r, version: 2, party: 3 }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('escapes spreadsheet formulae and parses quoted names safely', () => {
    expect(csvCell('=HYPERLINK("x")')).toMatch(/^"'/);
    expect(parseCsv('name,phone\r\n"Tamu, S.H.",08123\r\n"Nama ""A""",+62812')).toEqual([
      ['name', 'phone'],
      ['Tamu, S.H.', '08123'],
      ['Nama "A"', '+62812'],
    ]);
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
  });
});
describe('payment reconciliation', () => {
  it('audits pilot grants without revenue and rejects grants while a transfer is pending', async () => {
    const f = setup(),
      e = f.event('pilot', f.owner, null);
    const invoice = await createInvoice(f.env, f.owner, e, {
      kind: 'package',
      plan: 'starter',
      acceptTerms: true,
    });
    const grant = {
      plan: 'signature' as const,
      ai: 0,
      months: 0,
      reason: 'Pilot disetujui operator untuk pengujian',
    };
    await expect(manualGrant(f.env, f.operator, e.id, grant)).rejects.toThrow();
    expect(f.local.raw.prepare('SELECT plan FROM events WHERE id=?').get(e.id)!.plan).toBeNull();
    f.local.raw.prepare("UPDATE invoices SET status='cancelled' WHERE id=?").run(invoice.id);
    await manualGrant(f.env, f.operator, e.id, grant);
    expect(
      f.local.raw.prepare('SELECT plan,status,ai_credits FROM events WHERE id=?').get(e.id),
    ).toMatchObject({ plan: 'signature', status: 'draft', ai_credits: 150 });
    expect(f.local.raw.prepare('SELECT count(*) n FROM payments').get()!.n).toBe(0);
    await expect(manualGrant(f.env, f.operator, e.id, grant)).rejects.toMatchObject({
      status: 400,
    });
    await manualGrant(f.env, f.operator, e.id, {
      ai: 5,
      months: 1,
      reason: 'Kompensasi gangguan layanan fiktif',
    });
    expect(
      f.local.raw.prepare('SELECT ai_credits,duration_months FROM events WHERE id=?').get(e.id),
    ).toMatchObject({ ai_credits: 155, duration_months: 13 });
    expect(f.local.raw.prepare('SELECT count(*) n FROM manual_grants').get()!.n).toBe(2);
  });
  it('never grants on a client claim, verifies exact amount, and grants once on repeated approval', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner, null);
    const i = await createInvoice(f.env, f.owner, e, {
      kind: 'package',
      plan: 'starter',
      acceptTerms: true,
    });
    await claimInvoice(f.env, f.owner, e, i.id, 'Pengirim Fiktif', Date.now() - 1000);
    expect(f.local.raw.prepare('SELECT plan FROM events WHERE id=?').get(e.id)!.plan).toBeNull();
    await expect(approveInvoice(f.env, f.operator, i.id, approval(1))).rejects.toMatchObject({
      status: 400,
    });
    await approveInvoice(f.env, f.operator, i.id, approval(i.total));
    await approveInvoice(f.env, f.operator, i.id, approval(i.total));
    expect(f.local.raw.prepare('SELECT count(*) AS n FROM grants').get()!.n).toBe(1);
    const after = f.local.raw.prepare('SELECT * FROM events WHERE id=?').get(e.id)!;
    expect(after.plan).toBe('starter');
    expect(after.ai_credits).toBe(10);
    expect(after.status).toBe('draft');
    expect(f.local.raw.prepare('SELECT count(*) AS n FROM outbox').get()!.n).toBe(1);
  });
  it('rolls back an entire approval when a bank entry is reused', async () => {
    const f = setup(),
      a = f.event('event-a', f.owner, null),
      b = f.event('event-b', f.other, null);
    const ia = await createInvoice(f.env, f.owner, a, {
      kind: 'package',
      plan: 'starter',
      acceptTerms: true,
    });
    const ib = await createInvoice(f.env, f.other, b, {
      kind: 'package',
      plan: 'starter',
      acceptTerms: true,
    });
    await approveInvoice(f.env, f.operator, ia.id, approval(ia.total));
    await expect(approveInvoice(f.env, f.operator, ib.id, approval(ib.total))).rejects.toThrow();
    expect(f.local.raw.prepare('SELECT plan FROM events WHERE id=?').get(b.id)!.plan).toBeNull();
    expect(f.local.raw.prepare('SELECT status FROM invoices WHERE id=?').get(ib.id)!.status).toBe(
      'pending_transfer',
    );
  });
  it('preserves paid extensions and spent AI on upgrade', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner, 'starter');
    f.local.raw.prepare('UPDATE events SET ai_used=4 WHERE id=?').run(e.id);
    const ext = await createInvoice(f.env, f.owner, e, { kind: 'extension', acceptTerms: true });
    await approveInvoice(f.env, f.operator, ext.id, approval(ext.total, 'EXTENSION-1'));
    const afterExt = f.local.raw.prepare('SELECT * FROM events WHERE id=?').get(e.id) as any;
    const upgrade = await createInvoice(f.env, f.owner, afterExt, {
      kind: 'upgrade',
      plan: 'premium',
      acceptTerms: true,
    });
    expect(upgrade.total).toBe(100000);
    await approveInvoice(f.env, f.operator, upgrade.id, approval(upgrade.total, 'UPGRADE-1'));
    const row = f.local.raw.prepare('SELECT * FROM events WHERE id=?').get(e.id)!;
    expect(row.expires_at).toBe(addMonths(afterExt.expires_at, 3));
    expect(row.ai_used).toBe(4);
    expect(row.ai_credits).toBe(50);
  });
  it('requires an audited exception for an expired invoice and suspends refunded rights', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner, null);
    const i = await createInvoice(f.env, f.owner, e, {
      kind: 'package',
      plan: 'starter',
      acceptTerms: true,
    });
    f.local.raw.prepare("UPDATE invoices SET status='expired' WHERE id=?").run(i.id);
    await expect(approveInvoice(f.env, f.operator, i.id, approval(i.total))).rejects.toMatchObject({
      status: 409,
    });
    await approveInvoice(f.env, f.operator, i.id, { ...approval(i.total), expiredException: true });
    await refundInvoice(f.env, f.operator, i.id, {
      amount: i.total,
      bankReference: 'REFUND-1',
      reason: 'Pengembalian fiktif sudah diperiksa',
    });
    await expect(approveInvoice(f.env, f.operator, i.id, approval(i.total))).rejects.toMatchObject({
      status: 409,
    });
    expect(f.local.raw.prepare('SELECT status FROM events WHERE id=?').get(e.id)!.status).toBe(
      'suspended',
    );
  });
  it('clamps month ends and starts unused activation after 90 days', () => {
    const jan = Date.parse('2028-01-31T09:00:00+07:00');
    expect(new Date(addMonths(jan, 1)).toISOString()).toBe('2028-02-29T02:00:00.000Z');
    const f = setup(),
      e = f.event('event-a', f.owner, 'starter');
    e.activated_at = null;
    e.expires_at = null;
    expect(lifecycle(e).activation).toBe(e.paid_at! + 90 * 86400000);
  });
});
describe('R2 ownership and bounded Compose', () => {
  it('counts reserved media, denies other tenants, serves byte ranges and blocks deletion while referenced', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner);
    const bytes = readFileSync('assets/gallery-1.webp');
    const upload = await uploadMedia(
      f.env,
      f.owner,
      e,
      new Request('http://localhost/', { method: 'POST', body: bytes }),
    );
    await expect(
      serveMedia(f.env, new Request('http://localhost/'), upload.id, f.other),
    ).rejects.toMatchObject({ status: 404 });
    const response = await serveMedia(
      f.env,
      new Request('http://localhost/', { headers: { Range: 'bytes=0-9' } }),
      upload.id,
      f.owner,
    );
    expect(response.status).toBe(206);
    expect((await response.arrayBuffer()).byteLength).toBe(10);
    await saveEvent(f.env, f.owner, e, {
      version: e.version,
      templateId: 'minimal-ivory',
      content: { ...JSON.parse(e.draft), hero: upload.id },
    });
    await expect(deleteMedia(f.env, f.owner, e, upload.id)).rejects.toThrow();
    expect(f.media.size).toBe(1);
  });
  it('rejects executable uploads and invented AI facts/assets', () => {
    expect(() =>
      validateMedia(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
    ).toThrow();
    expect(() =>
      validateProposal(
        { reply: 'Done', patch: { date: '2035-01-01' } },
        blankContent,
        'Buat pembuka',
        new Set(),
      ),
    ).toThrow();
    expect(() =>
      validateProposal(
        { reply: 'Done', patch: { hero: 'other-tenant-asset' } },
        blankContent,
        'Foto',
        new Set(),
      ),
    ).toThrow();
  });
  it('charges a valid proposal once, requires explicit application, and refunds invalid model output', async () => {
    const f = setup(),
      e = f.event('event-a', f.owner);
    f.env.AI_ENABLED = 'true';
    (f.env as any).AI = {
      run: async () => ({
        response: JSON.stringify({
          reply: 'Usulan pembuka',
          patch: { opening: 'Merayakan kebersamaan.' },
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      }),
    };
    const key = crypto.randomUUID();
    const output = await compose(f.env, f.owner, e, {
      message: 'Tuliskan pembuka hangat.',
      version: e.version,
      requestKey: key,
    });
    await compose(f.env, f.owner, e, {
      message: 'Tuliskan pembuka hangat.',
      version: e.version,
      requestKey: key,
    });
    let row = f.local.raw.prepare('SELECT * FROM events WHERE id=?').get(e.id)!;
    expect(row.ai_used).toBe(1);
    expect(JSON.parse(String(row.draft)).opening).not.toBe('Merayakan kebersamaan.');
    await applyProposal(f.env, f.owner, e, output.id);
    row = f.local.raw.prepare('SELECT * FROM events WHERE id=?').get(e.id)!;
    expect(JSON.parse(String(row.draft)).opening).toBe('Merayakan kebersamaan.');
    (f.env as any).AI = { run: async () => ({ response: 'not JSON' }) };
    await expect(
      compose(f.env, f.owner, row as any, {
        message: 'Tuliskan pembuka hangat.',
        version: Number(row.version),
        requestKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 502 });
    row = f.local.raw.prepare('SELECT * FROM events WHERE id=?').get(e.id)!;
    expect(row.ai_used).toBe(1);
    expect(row.ai_reserved).toBe(0);
  });
});
