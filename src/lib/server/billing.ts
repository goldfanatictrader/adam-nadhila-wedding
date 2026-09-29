import { z } from 'zod';
import type { Env, Actor, EventRow } from '../types';
import { plans, addons, addMonths, type PlanId } from '../catalog';
import { eventTime } from '../content';
import { all, one, stmt, atomic, audit, id, now } from './db';
import { fail } from './http';
import { lifecycle } from './events';
export const businessSchema = z.object({
  bank: z.string().trim().min(2).max(80),
  number: z.string().regex(/^\d{5,40}$/),
  holder: z.string().trim().min(3).max(150),
  whatsapp: z.string().regex(/^[1-9]\d{7,14}$/),
  refundPolicy: z.string().min(20).max(3000),
  version: z.string().min(1).max(50),
});
export type Business = z.infer<typeof businessSchema>;
export type PriceBook = { id: string; plans: typeof plans; addons: typeof addons };
export type Invoice = {
  id: string;
  number: string;
  tenant_id: string;
  event_id: string;
  owner_id: string;
  kind: 'package' | 'upgrade' | 'ai' | 'extension' | 'setup';
  target_plan: PlanId | null;
  from_plan: PlanId | null;
  total: number;
  snapshot: string;
  status: string;
  expires_at: number;
  created_at: number;
  paid_at: number | null;
};
export async function priceBook(env: Env): Promise<PriceBook> {
  const row = await one<{ id: string; data: string }>(
    env.DB,
    'SELECT * FROM price_versions WHERE active=1 ORDER BY created_at DESC LIMIT 1',
  );
  return row ? { id: row.id, ...JSON.parse(row.data) } : { id: 'launch-v1', plans, addons };
}
export async function business(env: Env): Promise<Business | null> {
  const setting = await one<{ value: string }>(
    env.DB,
    "SELECT value FROM settings WHERE key='billing'",
  );
  const parsed = businessSchema.safeParse(setting ? JSON.parse(setting.value) : null);
  return parsed.success ? parsed.data : null;
}
export const invoiceInput = z.object({
  kind: z.enum(['package', 'upgrade', 'ai', 'extension', 'setup']),
  plan: z.enum(['starter', 'premium', 'signature']).optional(),
  activationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  acceptTerms: z.literal(true),
});
export async function createInvoice(
  env: Env,
  a: Actor,
  e: EventRow,
  input: z.infer<typeof invoiceInput>,
) {
  const bank = await business(env);
  if (!bank) fail(503, 'Pembayaran belum dibuka. Rekening bisnis dan WhatsApp sedang disiapkan.');
  if (env.APP_ENV !== 'local') {
    const retention = await one<{ value: string }>(
      env.DB,
      "SELECT value FROM settings WHERE key='billing_retention_days'",
    );
    const days = Number(retention?.value);
    if (!Number.isInteger(days) || days < 30 || days > 3650)
      fail(503, 'Pembayaran belum dibuka. Kebijakan retensi sedang disiapkan.');
  }
  if (e.status === 'suspended' || e.status === 'deleted') fail(403, 'Undangan sedang dibatasi.');
  await stmt(
    env.DB,
    "UPDATE invoices SET status='expired' WHERE event_id=? AND status='pending_transfer' AND expires_at<?",
    e.id,
    now(),
  ).run();
  const existing = await one<Invoice>(
    env.DB,
    "SELECT * FROM invoices WHERE event_id=? AND tenant_id=? AND kind=? AND status IN ('pending_transfer','pending_review','needs_clarification')",
    e.id,
    e.tenant_id,
    input.kind,
  );
  if (existing) return existing;
  const book =
    input.kind === 'upgrade' && e.plan_snapshot
      ? JSON.parse(e.plan_snapshot).book
      : await priceBook(env);
  let total = 0;
  let target = input.plan;
  let estimate = lifecycle(e).expires;
  if (input.kind === 'package') {
    if (e.plan || !target) fail(400, 'Pilih paket untuk undangan baru.');
    total = book.plans[target].price;
    const start = input.activationDate
      ? Date.parse(input.activationDate + 'T00:00:00+07:00')
      : now();
    if (!Number.isFinite(start) || start < now() - 86400000 || start > now() + 90 * 86400000)
      fail(400, 'Rencana aktivasi harus dalam 90 hari sejak pembayaran.');
    estimate = addMonths(start, book.plans[target].months, JSON.parse(e.draft).timezone);
  } else if (input.kind === 'upgrade') {
    if (!e.plan || !target || book.plans[target].price <= book.plans[e.plan].price)
      fail(400, 'Pilih paket yang lebih tinggi.');
    total = book.plans[target].price - book.plans[e.plan].price;
    estimate = estimate
      ? addMonths(
          estimate,
          book.plans[target].months - book.plans[e.plan].months,
          JSON.parse(e.draft).timezone,
        )
      : null;
  } else {
    if (!e.plan) fail(400, 'Aktifkan paket terlebih dahulu.');
    total = book.addons[input.kind].price;
    target = undefined;
    if (input.kind === 'extension')
      estimate = addMonths(Math.max(estimate || now(), now()), 6, JSON.parse(e.draft).timezone);
    else if ((estimate || 0) < now()) fail(400, 'Perpanjang undangan sebelum membeli tambahan.');
  }
  const snapshot = {
    book,
    business: bank,
    activationDate: input.activationDate || null,
    estimatedExpiry: estimate,
    eventCovered: estimate ? eventTime(JSON.parse(e.draft)) <= estimate : null,
    terms:
      'Masa aktif mulai saat publish pertama atau paling lambat 90 hari setelah approval. Konfirmasi WhatsApp dan pemeriksaan mutasi bank wajib. Setup terpisah, maksimum dua revisi.',
  };
  const invoiceId = id(),
    stamp = now(),
    number = `CLY-${new Date(stamp).toISOString().slice(0, 10).replaceAll('-', '')}-${invoiceId.slice(0, 8).toUpperCase()}`;
  await atomic(
    env.DB,
    "SELECT plan IS ? AND status NOT IN ('suspended','deleted') FROM events WHERE id=? AND tenant_id=?",
    [e.plan, e.id, e.tenant_id],
    [
      stmt(
        env.DB,
        'INSERT INTO invoices(id,number,tenant_id,event_id,owner_id,kind,target_plan,from_plan,total,snapshot,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        invoiceId,
        number,
        e.tenant_id,
        e.id,
        a.id,
        input.kind,
        target || null,
        e.plan,
        total,
        JSON.stringify(snapshot),
        stamp,
        stamp + 86400000,
      ),
      audit(env, a.id, 'invoice.create', e.tenant_id, e.id, number),
    ],
  );
  return (await one<Invoice>(env.DB, 'SELECT * FROM invoices WHERE id=?', invoiceId))!;
}
export async function claimInvoice(
  env: Env,
  a: Actor,
  e: EventRow,
  invoiceId: string,
  name: string,
  transferredAt: number,
) {
  if (transferredAt > now() + 60000 || transferredAt < now() - 30 * 86400000)
    fail(400, 'Waktu transfer tidak valid.');
  const invoice = await one<Invoice>(
    env.DB,
    'SELECT * FROM invoices WHERE id=? AND tenant_id=? AND event_id=? AND owner_id=?',
    invoiceId,
    e.tenant_id,
    e.id,
    a.id,
  );
  if (!invoice) fail(404, 'Invoice tidak ditemukan.');
  if (
    !['pending_transfer', 'pending_review', 'needs_clarification'].includes(invoice.status) ||
    (invoice.status === 'pending_transfer' && invoice.expires_at < now())
  )
    fail(
      409,
      'Invoice sudah berakhir. Hubungi WhatsApp billing dengan nomor invoice untuk rekonsiliasi.',
    );
  await atomic(
    env.DB,
    "SELECT status IN ('pending_transfer','pending_review','needs_clarification') FROM invoices WHERE id=?",
    [invoiceId],
    [
      stmt(
        env.DB,
        "UPDATE invoices SET status='pending_review',claim_name=?,transfer_at=?,claim_at=? WHERE id=? AND tenant_id=?",
        name,
        transferredAt,
        now(),
        invoiceId,
        e.tenant_id,
      ),
      audit(env, a.id, 'invoice.claim', e.tenant_id, e.id, invoice.number),
    ],
  );
  return { ok: true };
}
export const approvalInput = z.object({
  bankReference: z.string().trim().min(5).max(200),
  amount: z.number().int().positive(),
  whatsappReceived: z.literal(true),
  transferredAt: z.number().int().positive(),
  note: z.string().trim().min(10).max(1000),
  expiredException: z.boolean().default(false),
});
export async function approveInvoice(
  env: Env,
  a: Actor,
  invoiceId: string,
  input: z.infer<typeof approvalInput>,
) {
  const invoice = await one<Invoice>(env.DB, 'SELECT * FROM invoices WHERE id=?', invoiceId);
  if (!invoice) fail(404, 'Invoice tidak ditemukan.');
  if (invoice.status === 'paid') return { ok: true, alreadyApplied: true };
  if (
    invoice.status === 'refunded' ||
    (!input.expiredException &&
      (['expired', 'cancelled'].includes(invoice.status) ||
        (invoice.status === 'pending_transfer' && invoice.expires_at < now())))
  )
    fail(
      409,
      'Invoice berakhir. Gunakan pengecualian dengan alasan rekonsiliasi setelah verifikasi ulang.',
    );
  if (input.amount !== invoice.total)
    fail(
      400,
      'Nominal mutasi harus tepat sama dengan total invoice. Gunakan perlu klarifikasi untuk selisih.',
    );
  if (input.transferredAt > now() + 60000) fail(400, 'Waktu transfer tidak valid.');
  const e = await one<EventRow>(
    env.DB,
    "SELECT e.* FROM events e JOIN tenants t ON t.id=e.tenant_id WHERE e.id=? AND e.tenant_id=? AND e.status NOT IN ('deleted','suspended') AND t.status='active'",
    invoice.event_id,
    invoice.tenant_id,
  );
  if (!e) fail(409, 'Event tidak aktif. Selesaikan status akun dahulu.');
  const snap = JSON.parse(invoice.snapshot),
    book = snap.book;
  const stamp = now();
  const writes: D1PreparedStatement[] = [];
  if (invoice.kind === 'package') {
    if (e.plan) fail(409, 'Paket event sudah aktif.');
    const p = book.plans[invoice.target_plan!];
    writes.push(
      stmt(
        env.DB,
        'UPDATE events SET plan=?,plan_snapshot=?,paid_at=?,duration_months=?,ai_credits=ai_used+?,guest_limit=?,media_limit=?,photo_limit=?,version=version+1 WHERE id=? AND tenant_id=?',
        p.id,
        invoice.snapshot,
        stamp,
        p.months,
        p.ai,
        p.guests,
        p.media,
        p.photos,
        e.id,
        e.tenant_id,
      ),
    );
  } else if (invoice.kind === 'upgrade') {
    if (e.plan !== invoice.from_plan)
      fail(409, 'Paket berubah sejak invoice dibuat. Rekonsiliasi ulang diperlukan.');
    const p = book.plans[invoice.target_plan!],
      old = book.plans[e.plan!],
      delta = p.months - old.months;
    const life = lifecycle(e);
    const activated =
      e.activated_at ?? (life.activation && life.activation <= stamp ? life.activation : null);
    const expiry = activated ? addMonths(life.expires!, delta, JSON.parse(e.draft).timezone) : null;
    writes.push(
      stmt(
        env.DB,
        'UPDATE events SET plan=?,duration_months=duration_months+?,expires_at=?,activated_at=?,ai_credits=ai_credits+?,guest_limit=?,media_limit=?,photo_limit=?,version=version+1 WHERE id=? AND tenant_id=?',
        p.id,
        delta,
        expiry,
        activated,
        p.ai - old.ai,
        p.guests,
        p.media,
        p.photos,
        e.id,
        e.tenant_id,
      ),
    );
  } else if (invoice.kind === 'ai') {
    if (!e.plan) fail(409, 'Paket belum aktif.');
    writes.push(
      stmt(
        env.DB,
        'UPDATE events SET ai_credits=ai_credits+100 WHERE id=? AND tenant_id=?',
        e.id,
        e.tenant_id,
      ),
    );
  } else if (invoice.kind === 'extension') {
    if (!e.plan) fail(409, 'Paket belum aktif.');
    const life = lifecycle(e);
    const activated =
      e.activated_at ?? (life.activation && life.activation <= stamp ? life.activation : null);
    writes.push(
      activated
        ? stmt(
            env.DB,
            'UPDATE events SET expires_at=?,activated_at=?,duration_months=duration_months+6 WHERE id=? AND tenant_id=?',
            addMonths(Math.max(life.expires || stamp, stamp), 6, JSON.parse(e.draft).timezone),
            activated,
            e.id,
            e.tenant_id,
          )
        : stmt(
            env.DB,
            'UPDATE events SET duration_months=duration_months+6 WHERE id=? AND tenant_id=?',
            e.id,
            e.tenant_id,
          ),
    );
  } else if (invoice.kind === 'setup') {
    if (!e.plan) fail(409, 'Paket belum aktif.');
    writes.push(
      stmt(
        env.DB,
        'INSERT INTO setup_tickets(id,invoice_id,tenant_id,event_id,created_at) VALUES(?,?,?,?,?)',
        id(),
        invoiceId,
        e.tenant_id,
        e.id,
        stamp,
      ),
    );
  }
  const receiptUser = await one<{ email: string }>(
    env.DB,
    'SELECT email FROM user WHERE id=?',
    invoice.owner_id,
  );
  await atomic(
    env.DB,
    "SELECT i.status=? AND e.plan IS ? AND e.version=? AND e.status NOT IN ('suspended','deleted') FROM invoices i JOIN events e ON e.id=i.event_id AND e.tenant_id=i.tenant_id WHERE i.id=?",
    [invoice.status, e.plan, e.version, invoiceId],
    [
      stmt(
        env.DB,
        'INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?)',
        id(),
        invoiceId,
        input.bankReference.trim().toUpperCase(),
        input.amount,
        1,
        input.transferredAt,
        a.id,
        input.note,
        stamp,
      ),
      stmt(env.DB, 'INSERT INTO grants VALUES(?,?,?,?)', invoiceId, e.id, invoice.kind, stamp),
      ...writes,
      stmt(env.DB, "UPDATE invoices SET status='paid',paid_at=? WHERE id=?", stamp, invoiceId),
      stmt(
        env.DB,
        'INSERT OR IGNORE INTO outbox(id,recipient,subject,body,next_at) VALUES(?,?,?,?,?)',
        `paid:${invoiceId}`,
        receiptUser!.email,
        'Pembayaran CELEYO terverifikasi',
        `Pembayaran ${invoice.number} telah diverifikasi. Buka ${env.PUBLIC_SITE_URL}/app untuk melanjutkan. Publikasi undangan tetap berada di tangan Anda.`,
        stamp,
      ),
      audit(
        env,
        a.id,
        input.expiredException ? 'payment.approve_exception' : 'payment.approve',
        e.tenant_id,
        e.id,
        invoice.number,
      ),
    ],
  );
  return { ok: true };
}
export async function refundInvoice(
  env: Env,
  a: Actor,
  invoiceId: string,
  input: { amount: number; bankReference: string; reason: string },
) {
  const i = await one<Invoice>(env.DB, 'SELECT * FROM invoices WHERE id=?', invoiceId);
  if (!i || i.status !== 'paid' || input.amount !== i.total)
    fail(400, 'Refund penuh hanya untuk invoice paid dengan nominal sesuai.');
  await atomic(
    env.DB,
    "SELECT status='paid' FROM invoices WHERE id=?",
    [i.id],
    [
      stmt(
        env.DB,
        'INSERT INTO refunds VALUES(?,?,?,?,?,?)',
        i.id,
        input.amount,
        input.bankReference.trim().toUpperCase(),
        a.id,
        input.reason,
        now(),
      ),
      stmt(env.DB, "UPDATE invoices SET status='refunded' WHERE id=?", i.id),
      stmt(
        env.DB,
        "UPDATE events SET status='suspended' WHERE id=? AND tenant_id=?",
        i.event_id,
        i.tenant_id,
      ),
      audit(env, a.id, 'payment.refund_suspend', i.tenant_id, i.event_id, i.number),
    ],
  );
  return {
    ok: true,
    message:
      'Refund dicatat. Event ditangguhkan untuk peninjauan hak paket sebelum diaktifkan kembali.',
  };
}
export async function listInvoices(env: Env, e: EventRow) {
  return all(
    env.DB,
    'SELECT * FROM invoices WHERE event_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 100',
    e.id,
    e.tenant_id,
  );
}

export const grantInput = z.object({
  plan: z.enum(['starter', 'premium', 'signature']).optional(),
  ai: z.number().int().min(0).max(500).default(0),
  months: z.number().int().min(0).max(12).default(0),
  reason: z.string().trim().min(10).max(1000),
});
export async function manualGrant(
  env: Env,
  a: Actor,
  eventId: string,
  input: z.infer<typeof grantInput>,
) {
  const e = await one<EventRow>(
    env.DB,
    "SELECT * FROM events WHERE id=? AND status NOT IN ('deleted','suspended')",
    eventId,
  );
  if (!e) fail(404, 'Event tidak ditemukan atau sedang ditangguhkan.');
  const book = await priceBook(env),
    stamp = now(),
    writes: D1PreparedStatement[] = [];
  if (!e.plan) {
    if (!input.plan) fail(400, 'Pilih paket untuk grant pertama.');
    const p = book.plans[input.plan];
    writes.push(
      stmt(
        env.DB,
        'UPDATE events SET plan=?,plan_snapshot=?,paid_at=?,duration_months=?,ai_credits=ai_used+?,guest_limit=?,media_limit=?,photo_limit=?,version=version+1 WHERE id=? AND tenant_id=?',
        p.id,
        JSON.stringify({ book, grant: 'pilot' }),
        stamp,
        p.months,
        p.ai,
        p.guests,
        p.media,
        p.photos,
        e.id,
        e.tenant_id,
      ),
    );
  } else {
    if (input.plan || input.ai + input.months === 0)
      fail(400, 'Untuk event berpaket, isi kompensasi AI atau bulan tambahan.');
    const life = lifecycle(e),
      activated =
        e.activated_at ?? (life.activation && life.activation <= stamp ? life.activation : null);
    const expiry =
      activated && input.months
        ? addMonths(
            Math.max(life.expires || stamp, stamp),
            input.months,
            JSON.parse(e.draft).timezone,
          )
        : e.expires_at;
    writes.push(
      stmt(
        env.DB,
        'UPDATE events SET ai_credits=ai_credits+?,duration_months=duration_months+?,activated_at=?,expires_at=?,version=version+1 WHERE id=? AND tenant_id=?',
        input.ai,
        input.months,
        activated,
        expiry,
        e.id,
        e.tenant_id,
      ),
    );
  }
  await atomic(
    env.DB,
    "SELECT version=? AND plan IS ? AND status NOT IN ('deleted','suspended') AND NOT EXISTS(SELECT 1 FROM invoices WHERE event_id=? AND status IN ('pending_transfer','pending_review','needs_clarification')) FROM events WHERE id=? AND tenant_id=?",
    [e.version, e.plan, e.id, e.id, e.tenant_id],
    [
      ...writes,
      stmt(
        env.DB,
        'INSERT INTO manual_grants VALUES(?,?,?,?,?,?,?,?)',
        id(),
        e.tenant_id,
        e.id,
        a.id,
        e.plan ? 'compensation' : 'pilot',
        JSON.stringify(input),
        input.reason,
        stamp,
      ),
      audit(env, a.id, 'entitlement.manual_grant', e.tenant_id, e.id, input.reason),
    ],
  );
  return { ok: true };
}
